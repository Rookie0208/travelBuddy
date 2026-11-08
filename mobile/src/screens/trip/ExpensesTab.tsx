import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Expense, TripDetail } from '../../api/types';
import { Avatar, EmptyState, ErrorState, Loading } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, shadows, space, type } from '../../theme';
import { formatDate } from '../../utils/format';
import { formatPaise } from '../../utils/money';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍕',
  STAY: '🏨',
  TRANSPORT: '🚗',
  FUEL: '⛽',
  ACTIVITIES: '🎟️',
  SHOPPING: '🛍️',
  OTHER: '🧾',
};

function ExpenseCard({
  item,
  currency,
  onPress,
}: {
  item: Expense;
  currency: string;
  onPress: () => void;
}) {
  const icon = CATEGORY_ICONS[item.category] || '🧾';
  const splitCount = item.splits.length;
  const perPersonPaise = splitCount > 0 ? Math.round(item.amountPaise / splitCount) : 0;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.expenseCard,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          {/* Left: Category Icon Circle */}
          <View style={styles.categoryCircle}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>

          {/* Middle: Title, Payer, Date */}
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <Text style={styles.expenseTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Avatar name={item.paidByName} size={18} />
              <Text style={styles.expenseMeta} numberOfLines={1}>
                {item.paidByName} • {formatDate(item.date)}
              </Text>
            </View>
          </View>

          {/* Right: Amount & Share */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.expenseAmount}>
              {formatPaise(item.amountPaise, currency)}
            </Text>
            <Text style={styles.perPersonShare}>
              {formatPaise(perPersonPaise, currency)}/ea ({splitCount})
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function ExpensesTab({
  trip,
  navigation,
}: {
  trip: TripDetail;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Trip'>;
}) {
  const q = useInfiniteQuery({
    queryKey: ['expenses', trip.id],
    queryFn: ({ pageParam }) => endpoints.ledger.expenses(trip.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * last.size < last.total ? last.page + 1 : undefined,
  });

  if (q.isLoading) return <Loading />;
  if (q.isError)
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const settled = trip.status === 'SETTLED';

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => {
              q.refetch();
            }}
          />
        }
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        ListEmptyComponent={
          <EmptyState
            title="No expenses yet"
            hint="Add your first trip expense. The engine automatically handles fair splitting."
          />
        }
        renderItem={({ item }) => (
          <ExpenseCard
            item={item}
            currency={trip.currency}
            onPress={() =>
              navigation.navigate('ExpenseDetail', { tripId: trip.id, expense: item })
            }
          />
        )}
        ListFooterComponent={q.isFetchingNextPage ? <Loading /> : undefined}
      />

      {settled && (
        <View style={{ padding: space.md, alignItems: 'center' }}>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Trip settled. Reopen from trip settings to add more expenses.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: space.lg,
    paddingBottom: 80,
    flexGrow: 1,
    gap: space.sm,
  },
  expenseCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  categoryCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lineLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  expenseMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  perPersonShare: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  addExpenseButton: {
    backgroundColor: '#D4FF00',
    height: 48,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.md,
  },
  addExpenseText: {
    color: '#08251C',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
