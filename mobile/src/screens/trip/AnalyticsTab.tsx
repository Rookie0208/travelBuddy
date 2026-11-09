import React from 'react';
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Stats, TripDetail } from '../../api/types';
import { Avatar, EmptyState, ErrorState, Loading } from '../../components/ui';
import { colors, radius, shadows, space, type } from '../../theme';
import { formatDate } from '../../utils/format';
import { formatPaise } from '../../utils/money';

const CATEGORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  FOOD: { emoji: '🍕', color: '#F97316', label: 'Food & Dining' },
  STAY: { emoji: '🏨', color: '#8B5CF6', label: 'Stay & Hotels' },
  TRANSPORT: { emoji: '🚗', color: '#3B82F6', label: 'Transport' },
  FUEL: { emoji: '⛽', color: '#EAB308', label: 'Fuel' },
  ACTIVITIES: { emoji: '🎟️', color: '#EC4899', label: 'Activities' },
  SHOPPING: { emoji: '🛍️', color: '#10B981', label: 'Shopping' },
  OTHER: { emoji: '🧾', color: '#64748B', label: 'Other' },
};

function getCategoryMeta(key: string) {
  const upper = (key || 'OTHER').toUpperCase();
  return CATEGORY_META[upper] || { emoji: '🧾', color: '#64748B', label: key || 'Other' };
}

export default function AnalyticsTab({ trip }: { trip: TripDetail }) {
  const q = useQuery({
    queryKey: ['trip-stats', trip.id],
    queryFn: () => endpoints.ledger.stats(trip.id),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) {
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }

  const data = q.data;
  if (!data || data.totalSpentPaise === 0 || data.totalExpensesCount === 0) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: space.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />
        }
      >
        <EmptyState
          icon="stats-chart-outline"
          title="No Spending Stats Yet"
          hint="Once you add expenses to this trip, full category breakdowns, member fair shares, daily burn rate, and top transactions will appear here!"
        />
      </ScrollView>
    );
  }

  const currency = data.currency || trip.currency || 'INR';
  const totalSpent = data.totalSpentPaise;

  // Sorted categories descending
  const categoriesList = Object.entries(data.byCategory || {})
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? Math.round((amount * 1000) / totalSpent) / 10 : 0,
      meta: getCategoryMeta(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  // Sorted days chronologically
  const daysList = Object.entries(data.byDay || {})
    .map(([day, amount]) => ({
      day,
      amount,
      percentage: totalSpent > 0 ? Math.round((amount * 1000) / totalSpent) / 10 : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const maxDayAmount = Math.max(...daysList.map((d) => d.amount), 1);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />
      }
    >
      {/* ── 1. Velto Forest Hero Card ── */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#0A1813" />
            <Text style={styles.heroBadgeText}>TRIP SPENDING ANALYTICS</Text>
          </View>
          <Text style={styles.heroCurrencyCode}>{currency}</Text>
        </View>

        <Text style={styles.heroLabel}>Total Group Spend</Text>
        <Text style={styles.heroTotalText}>{formatPaise(totalSpent, currency)}</Text>

        <View style={styles.heroDivider} />

        {/* 3-Column Micro Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{data.totalExpensesCount}</Text>
            <Text style={styles.metricLabel}>Transactions</Text>
          </View>
          <View style={styles.metricSeparator} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatPaise(data.averageExpensePaise, currency)}
            </Text>
            <Text style={styles.metricLabel}>Avg / Expense</Text>
          </View>
          <View style={styles.metricSeparator} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatPaise(data.dailyAveragePaise, currency)}
            </Text>
            <Text style={styles.metricLabel}>Daily Burn</Text>
          </View>
        </View>
      </View>

      {/* ── 2. Personal Position Card ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>My Spending Position</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  data.myNetPaise > 0
                    ? '#DCFCE7'
                    : data.myNetPaise < 0
                    ? '#FEE2E2'
                    : '#F1F5F9',
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                {
                  color:
                    data.myNetPaise > 0
                      ? '#15803D'
                      : data.myNetPaise < 0
                      ? '#B91C1C'
                      : '#475569',
                },
              ]}
            >
              {data.myNetPaise > 0
                ? 'Gets Back'
                : data.myNetPaise < 0
                ? 'Owes'
                : 'Settled'}
            </Text>
          </View>
        </View>

        <View style={styles.personalGrid}>
          <View style={styles.personalCol}>
            <Text style={styles.personalLabel}>Fair Share</Text>
            <Text style={styles.personalValue}>
              {formatPaise(data.mySharePaise, currency)}
            </Text>
          </View>

          <View style={styles.personalDivider} />

          <View style={styles.personalCol}>
            <Text style={styles.personalLabel}>I Paid</Text>
            <Text style={[styles.personalValue, { color: colors.primary }]}>
              {formatPaise(data.myPaidPaise, currency)}
            </Text>
          </View>

          <View style={styles.personalDivider} />

          <View style={styles.personalCol}>
            <Text style={styles.personalLabel}>Net Balance</Text>
            <Text
              style={[
                styles.personalValue,
                {
                  color:
                    data.myNetPaise > 0
                      ? '#15803D'
                      : data.myNetPaise < 0
                      ? '#DC2626'
                      : colors.ink,
                },
              ]}
            >
              {data.myNetPaise > 0
                ? `+${formatPaise(data.myNetPaise, currency)}`
                : data.myNetPaise < 0
                ? `-${formatPaise(Math.abs(data.myNetPaise), currency)}`
                : '₹0.00'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3. Category Breakdown ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pie-chart-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
          </View>
          <Text style={styles.sectionCountBadge}>{categoriesList.length} categories</Text>
        </View>

        <View style={{ marginTop: space.sm, gap: 14 }}>
          {categoriesList.map((cat) => (
            <View key={cat.category}>
              <View style={styles.catRowHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 18 }}>{cat.meta.emoji}</Text>
                  <Text style={styles.catLabel} numberOfLines={1}>
                    {cat.meta.label}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.catAmount}>{formatPaise(cat.amount, currency)}</Text>
                  <View style={styles.catPercentBadge}>
                    <Text style={styles.catPercentText}>{cat.percentage}%</Text>
                  </View>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(cat.percentage, 100)}%`,
                      backgroundColor: cat.meta.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── 4. Member Contributions & Fair Share ── */}
      {data.memberSpending && data.memberSpending.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Member Fair Shares</Text>
            </View>
            <Text style={styles.sectionCountBadge}>
              {data.memberSpending.length} members
            </Text>
          </View>

          <View style={{ marginTop: space.sm, gap: 16 }}>
            {data.memberSpending.map((m) => (
              <View key={m.memberId} style={styles.memberCard}>
                <View style={styles.memberTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Avatar name={m.name} size={30} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.name}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.netMiniBadge,
                      {
                        backgroundColor:
                          m.netPaise > 0
                            ? '#DCFCE7'
                            : m.netPaise < 0
                            ? '#FEE2E2'
                            : '#F1F5F9',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.netMiniText,
                        {
                          color:
                            m.netPaise > 0
                              ? '#15803D'
                              : m.netPaise < 0
                              ? '#B91C1C'
                              : '#64748B',
                        },
                      ]}
                    >
                      {m.netPaise > 0
                        ? `+${formatPaise(m.netPaise, currency)}`
                        : m.netPaise < 0
                        ? `-${formatPaise(Math.abs(m.netPaise), currency)}`
                        : 'Settled'}
                    </Text>
                  </View>
                </View>

                {/* Dual Bars: Paid vs Share */}
                <View style={{ marginTop: 10, gap: 6 }}>
                  {/* Paid Bar */}
                  <View>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barTitle}>Paid</Text>
                      <Text style={styles.barAmount}>
                        {formatPaise(m.paidPaise, currency)} ({m.paidPercent}%)
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(m.paidPercent, 100)}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Share Bar */}
                  <View>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barTitle}>Share</Text>
                      <Text style={styles.barAmount}>
                        {formatPaise(m.sharePaise, currency)} ({m.sharePercent}%)
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(m.sharePercent, 100)}%`,
                            backgroundColor: '#3B82F6',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── 5. Daily Spending Velocity Timeline ── */}
      {daysList.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Daily Spending Timeline</Text>
            </View>
            <Text style={styles.sectionCountBadge}>{daysList.length} active days</Text>
          </View>

          <View style={{ marginTop: space.sm, gap: 10 }}>
            {daysList.map((d) => {
              const barWidthPct = Math.round((d.amount * 100) / maxDayAmount);
              return (
                <View key={d.day} style={styles.dayRow}>
                  <View style={{ width: 92 }}>
                    <Text style={styles.dayText}>{formatDate(d.day)}</Text>
                  </View>

                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <View style={styles.dayBarTrack}>
                      <View
                        style={[
                          styles.dayBarFill,
                          {
                            width: `${Math.max(barWidthPct, 4)}%`,
                            backgroundColor: '#D4FF00',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={{ width: 88, alignItems: 'flex-end' }}>
                    <Text style={styles.dayAmountText}>{formatPaise(d.amount, currency)}</Text>
                    <Text style={styles.dayPctText}>{d.percentage}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── 6. Top Expenses ── */}
      {data.topExpenses && data.topExpenses.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trophy-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Top Expenses</Text>
            </View>
            <Text style={styles.sectionCountBadge}>Highest spend</Text>
          </View>

          <View style={{ marginTop: space.sm, gap: 10 }}>
            {data.topExpenses.map((exp, idx) => {
              const meta = getCategoryMeta(exp.category);
              return (
                <View key={exp.id} style={styles.topExpenseRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{idx + 1}</Text>
                  </View>

                  <View style={styles.catEmojiCircle}>
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                  </View>

                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <Text style={styles.topExpenseTitle} numberOfLines={1}>
                      {exp.title}
                    </Text>
                    <Text style={styles.topExpenseSub} numberOfLines={1}>
                      {exp.paidByName} • {formatDate(exp.date)}
                    </Text>
                  </View>

                  <Text style={styles.topExpenseAmount}>
                    {formatPaise(exp.amountPaise, currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space.md,
    paddingBottom: 110,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#0A1813',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D4FF00',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1813',
    letterSpacing: 0.6,
  },
  heroCurrencyCode: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroTotalText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#D4FF00',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  metricSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: space.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#091A14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionCountBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },

  // Personal Card
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  personalGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  personalCol: {
    flex: 1,
    alignItems: 'center',
  },
  personalLabel: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 4,
  },
  personalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  personalDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },

  // Category Rows
  catRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
  },
  catAmount: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  catPercentBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 42,
    alignItems: 'center',
  },
  catPercentText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Member Spending
  memberCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  netMiniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  netMiniText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  barTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  barAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },

  // Daily Row
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  dayBarTrack: {
    height: 10,
    backgroundColor: '#0A1813',
    borderRadius: 5,
    overflow: 'hidden',
  },
  dayBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  dayAmountText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  dayPctText: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: '500',
  },

  // Top Expenses
  topExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rankBadge: {
    width: 24,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary,
  },
  catEmojiCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topExpenseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  topExpenseSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  topExpenseAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
});
