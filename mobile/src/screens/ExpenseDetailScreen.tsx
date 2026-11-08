import React from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { Avatar, Button, Card, Chip } from '../components/ui';
import { invalidateTrip } from '../queries';
import { colors, radius, shadows, space, type } from '../theme';
import { formatDate } from '../utils/format';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';
import { ActivityRow, CommentBox } from './trip/HistoryTab';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍕',
  STAY: '🏨',
  TRANSPORT: '🚗',
  FUEL: '⛽',
  ACTIVITIES: '🎟️',
  SHOPPING: '🛍️',
  OTHER: '🧾',
};

export default function ExpenseDetailScreen({ route, navigation }: Props<'ExpenseDetail'>) {
  const { tripId, expense } = route.params;
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: ['trip', tripId], queryFn: () => endpoints.trips.get(tripId) });
  const acts = useQuery({ queryKey: ['activities', tripId], queryFn: () => endpoints.ledger.activities(tripId) });
  const currency = trip.data?.currency ?? 'INR';
  const settled = trip.data?.status === 'SETTLED';
  const thread = (acts.data?.items ?? []).filter((a) => a.expenseId === expense.id).slice().reverse();

  const icon = CATEGORY_ICONS[expense.category] || '🧾';

  const remove = () =>
    Alert.alert('Delete this expense?', 'It will be removed from balances. The activity history keeps a log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
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
    <View style={styles.screen}>
      <FlatList
        data={thread}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <View style={{ marginBottom: space.md, paddingHorizontal: space.xs }}>
              <Text style={type.caption}>TRANSACTION DETAILS</Text>
              <Text style={[type.largeTitle, { fontSize: 26, marginTop: 2 }]}>Expense Summary</Text>
            </View>

            {/* 1. Digital Receipt Card */}
            <View style={styles.receiptCard}>
              <View style={styles.receiptTop}>
                <View style={styles.categoryBadge}>
                  <Text style={{ fontSize: 18 }}>{icon}</Text>
                  <Text style={styles.categoryBadgeText}>
                    {expense.category.charAt(0) + expense.category.slice(1).toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.receiptDate}>{formatDate(expense.date)}</Text>
              </View>

              <Text style={styles.receiptTitle}>{expense.title}</Text>
              <Text style={styles.receiptAmount}>
                {formatPaise(expense.amountPaise, currency)}
              </Text>

              {/* Payer info */}
              <View style={styles.receiptPayerRow}>
                <Avatar name={expense.paidByName} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payerLabel}>PAID BY</Text>
                  <Text style={styles.payerName}>{expense.paidByName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.payerLabel}>RECORDED BY</Text>
                  <Text style={styles.creatorName}>{expense.createdByName}</Text>
                </View>
              </View>
            </View>

            {/* 2. Shares Breakdown Card */}
            <View style={styles.sharesCard}>
              <View style={styles.sharesHeader}>
                <Text style={styles.sharesHeaderText}>
                  SPLIT BREAKDOWN ({expense.splits.length})
                </Text>
                <Text style={styles.sharesSubtext}>Equal distribution</Text>
              </View>

              {expense.splits.map((s, idx) => (
                <View
                  key={s.memberId}
                  style={[
                    styles.shareRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.lineLight },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Avatar name={s.memberName} size={30} />
                    <Text style={styles.shareMemberName}>{s.memberName}</Text>
                  </View>
                  <Text style={styles.shareAmount}>
                    {formatPaise(s.sharePaise, currency)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Actions: Edit / Delete */}
            {!settled && (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('ExpenseForm', { tripId, expense })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={17} color={colors.primary} />
                  <Text style={styles.editButtonText}>Edit Expense</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={remove}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ marginTop: space.lg, marginBottom: space.xs }}>
              <Text style={type.caption}>COMMENTS & AUDIT HISTORY</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCommentsBox}>
            <Text style={[type.small, { textAlign: 'center' }]}>
              No comments or queries on this expense yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ActivityRow a={item} />}
      />
      <CommentBox tripId={tripId} expenseId={expense.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: space.lg,
    paddingBottom: 20,
  },
  receiptCard: {
    backgroundColor: '#0A1813',
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    ...shadows.md,
    marginBottom: space.md,
  },
  receiptTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  categoryBadgeText: {
    color: '#D4FF00',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  receiptTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  receiptAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: space.sm,
  },
  receiptPayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: space.md,
    marginTop: space.xs,
  },
  payerLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  payerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  creatorName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sharesCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
    marginBottom: space.md,
  },
  sharesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  sharesHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.6,
  },
  sharesSubtext: {
    fontSize: 11,
    color: colors.subtle,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  shareMemberName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.ink,
  },
  shareAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  editButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  emptyCommentsBox: {
    padding: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
});
