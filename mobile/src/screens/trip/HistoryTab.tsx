import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Activity, TripDetail } from '../../api/types';
import { Button, Chip, EmptyState, ErrorState, Loading } from '../../components/ui';
import { colors, space, type } from '../../theme';
import { formatWhen } from '../../utils/format';

export function ActivityRow({ a }: { a: Activity }) {
  const isNote = a.type === 'COMMENT' || a.type === 'QUERY';
  if (!isNote) {
    return (
      <View style={{ paddingVertical: 8, paddingHorizontal: space.sm }}>
        <Text style={{ fontSize: 14, color: colors.ink }}>{a.message}</Text>
        <Text style={type.small}>{formatWhen(a.createdAt)}</Text>
      </View>
    );
  }
  const q = a.type === 'QUERY';
  return (
    <View style={{ backgroundColor: q ? colors.warnSoft : colors.primarySoft, borderRadius: 14, padding: space.md, marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{a.actorName}{q ? '  ·  Query' : ''}</Text>
        <Text style={type.small}>{formatWhen(a.createdAt)}</Text>
      </View>
      <Text style={{ fontSize: 15, color: colors.ink, marginTop: 4 }}>{a.message}</Text>
    </View>
  );
}

/** Text box to write a comment, or raise a query that everyone in the trip can see. */
export function CommentBox({ tripId, expenseId }: { tripId: string; expenseId?: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [asQuery, setAsQuery] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await endpoints.ledger.comment(tripId, text.trim(), asQuery, expenseId);
      setText('');
      setAsQuery(false);
      qc.invalidateQueries({ queryKey: ['activities', tripId] });
    } catch (e) {
      Alert.alert('Could not send', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row' }}>
        <Chip label="Comment" selected={!asQuery} onPress={() => setAsQuery(false)} />
        <Chip label="Raise a query" selected={asQuery} onPress={() => setAsQuery(true)} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={asQuery ? 'Ask everyone a question…' : 'Write a comment…'}
          placeholderTextColor="#9AA1AB"
          multiline
          maxLength={1000}
          style={{ flex: 1, minHeight: 44, maxHeight: 110, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: space.md, paddingTop: 10, backgroundColor: '#fff', fontSize: 15 }}
        />
        <Button title="Send" small onPress={send} loading={busy} disabled={!text.trim()} />
      </View>
    </View>
  );
}

export default function HistoryTab({ trip }: { trip: TripDetail }) {
  const q = useQuery({ queryKey: ['activities', trip.id], queryFn: () => endpoints.ledger.activities(trip.id) });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={q.data.items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={<EmptyState title="Nothing here yet" hint="Every expense, edit and repayment shows up here for everyone in the trip." />}
        renderItem={({ item }) => <ActivityRow a={item} />}
      />
      <CommentBox tripId={trip.id} />
    </View>
  );
}
