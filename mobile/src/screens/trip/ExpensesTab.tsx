import React from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { TripDetail } from '../../api/types';
import { Button, Card, EmptyState, ErrorState, Loading } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { colors, space, type } from '../../theme';
import { formatDate } from '../../utils/format';
import { formatPaise } from '../../utils/money';

export default function ExpensesTab({ trip, navigation }: {
  trip: TripDetail; navigation: NativeStackNavigationProp<RootStackParamList, 'Trip'>;
}) {
  const q = useInfiniteQuery({
    queryKey: ['expenses', trip.id],
    queryFn: ({ pageParam }) => endpoints.ledger.expenses(trip.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.total ? last.page + 1 : undefined),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const settled = trip.status === 'SETTLED';

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} />}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
        ListEmptyComponent={<EmptyState title="No expenses yet" hint="Add the first one: amount, who paid, and who shares it. The app splits it for you." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ExpenseDetail', { tripId: trip.id, expense: item })}>
            <Card style={{ paddingVertical: space.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Text style={type.heading}>{item.title}</Text>
                  <Text style={[type.small, { marginTop: 2 }]}>
                    Paid by {item.paidByName} · {item.splits.length} {item.splits.length === 1 ? 'person' : 'people'} · {formatDate(item.date)}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{formatPaise(item.amountPaise, trip.currency)}</Text>
              </View>
            </Card>
          </Pressable>
        )}
        ListFooterComponent={q.isFetchingNextPage ? <Loading /> : undefined}
      />
      {settled ? (
        <View style={{ padding: space.lg }}>
          <Text style={[type.small, { textAlign: 'center' }]}>This trip is settled. The owner can reopen it to add more.</Text>
        </View>
      ) : (
        <View style={{ padding: space.lg }}>
          <Button title="Add expense" onPress={() => navigation.navigate('ExpenseForm', { tripId: trip.id })} />
        </View>
      )}
    </View>
  );
}
