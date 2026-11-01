import React from 'react';
import { Alert, FlatList, View, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { Button, Card, Chip } from '../components/ui';
import { invalidateTrip } from '../queries';
import { colors, space, type } from '../theme';
import { formatDate } from '../utils/format';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';
import { ActivityRow, CommentBox } from './trip/HistoryTab';

export default function ExpenseDetailScreen({ route, navigation }: Props<'ExpenseDetail'>) {
  const { tripId, expense } = route.params;
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: ['trip', tripId], queryFn: () => endpoints.trips.get(tripId) });
  const acts = useQuery({ queryKey: ['activities', tripId], queryFn: () => endpoints.ledger.activities(tripId) });
  const currency = trip.data?.currency ?? 'INR';
  const settled = trip.data?.status === 'SETTLED';
  const thread = (acts.data?.items ?? []).filter((a) => a.expenseId === expense.id).slice().reverse();   // oldest first

  const remove = () => Alert.alert('Delete this expense?', 'It will be removed from the balances. The history keeps a record of it.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive',
      onPress: async () => {
        try {
          await endpoints.ledger.deleteExpense(tripId, expense.id);
          invalidateTrip(qc, tripId);
          navigation.goBack();
        } catch (e) {
          Alert.alert('Could not delete', errorMessage(e));
        }
      },
    },
  ]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={thread}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: space.lg }}
        ListHeaderComponent={
          <View>
            <Card>
              <Text style={type.title}>{expense.title}</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink, marginVertical: space.sm }}>{formatPaise(expense.amountPaise, currency)}</Text>
              <Text style={type.small}>Paid by {expense.paidByName} · {formatDate(expense.date)}</Text>
              <Text style={type.small}>Added by {expense.createdByName}</Text>
              <View style={{ flexDirection: 'row', marginTop: space.md }}><Chip label={expense.category.charAt(0) + expense.category.slice(1).toLowerCase()} /></View>
            </Card>
            <Card>
              <Text style={[type.heading, { marginBottom: space.sm }]}>Split</Text>
              {expense.splits.map((s) => (
                <View key={s.memberId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={type.body}>{s.memberName}</Text>
                  <Text style={type.body}>{formatPaise(s.sharePaise, currency)}</Text>
                </View>
              ))}
            </Card>
            {!settled ? (
              <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
                <Button title="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => navigation.navigate('ExpenseForm', { tripId, expense })} />
                <Button title="Delete" variant="danger" style={{ flex: 1 }} onPress={remove} />
              </View>
            ) : null}
            <Text style={[type.heading, { marginBottom: space.xs }]}>Comments and history</Text>
          </View>
        }
        ListEmptyComponent={<Text style={type.small}>No comments yet. Ask a question or leave a note for the group below.</Text>}
        renderItem={({ item }) => <ActivityRow a={item} />}
      />
      <CommentBox tripId={tripId} expenseId={expense.id} />
    </View>
  );
}
