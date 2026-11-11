import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { Card, EmptyState, ErrorState, Loading } from '../components/ui';
import { colors, radius, shadows, space, type } from '../theme';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';
import type { UserExpenseItem, UserWeekStat } from '../api/types';

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  FOOD: 'restaurant-outline',
  STAY: 'bed-outline',
  TRANSPORT: 'car-outline',
  FUEL: 'speedometer-outline',
  ACTIVITIES: 'ticket-outline',
  SHOPPING: 'bag-handle-outline',
  OTHER: 'receipt-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#F59E0B',
  STAY: '#3B82F6',
  TRANSPORT: '#8B5CF6',
  FUEL: '#EF4444',
  ACTIVITIES: '#EC4899',
  SHOPPING: '#10B981',
  OTHER: '#6B7280',
};

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatMonthLabel(monthStr: string): string {
  try {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

export default function SpendingAnalyticsScreen({ route, navigation }: Props<'SpendingAnalytics'>) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const initialTab = route.params?.initialTab ?? 'week';
  const initialMonth = route.params?.month ?? '';

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month' | 'archive'>(initialTab);
  const [heatmapScope, setHeatmapScope] = useState<'month' | 'week'>('month');
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState<number | null>(null);
  const [expandedWeekNumber, setExpandedWeekNumber] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const analyticsQuery = useQuery({
    queryKey: ['userAnalytics', selectedMonth],
    queryFn: () => endpoints.auth.analytics(selectedMonth || undefined),
  });

  const data = analyticsQuery.data;

  // Active month display
  const currentMonth = data?.month || selectedMonth || new Date().toISOString().substring(0, 7);
  const isCurrentCalendarMonth =
    currentMonth === new Date().toISOString().substring(0, 7);

  // Parse Year & Month for Calendar Grid alignment
  const { year, monthNum, firstWeekdayIndex, daysInMonth } = useMemo(() => {
    try {
      const [y, m] = currentMonth.split('-').map(Number);
      const firstDay = new Date(y, m - 1, 1);
      // getDay: 0 is Sunday. Convert to Mon=0 ... Sun=6
      const fwIdx = (firstDay.getDay() + 6) % 7;
      const totalDays = new Date(y, m, 0).getDate();
      return { year: y, monthNum: m, firstWeekdayIndex: fwIdx, daysInMonth: totalDays };
    } catch {
      return { year: 2026, monthNum: 11, firstWeekdayIndex: 6, daysInMonth: 30 };
    }
  }, [currentMonth]);

  // Heatmap intensity calculation
  const maxDaySpend = useMemo(() => {
    if (!data?.byDay || data.byDay.length === 0) return 1;
    const maxVal = Math.max(...data.byDay.map(d => d.personalSharePaise), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [data?.byDay]);

  const getHeatmapColor = (sharePaise: number) => {
    if (sharePaise <= 0) return '#F1F5F9';
    const ratio = sharePaise / maxDaySpend;
    if (ratio < 0.25) return '#BBF7D0';
    if (ratio < 0.5) return '#4ADE80';
    if (ratio < 0.75) return '#16A34A';
    return '#15803D';
  };

  // Day filter for heatmap
  const selectedDayExpenses = useMemo(() => {
    if (!selectedDayOfMonth || !data?.expenses) return [];
    return data.expenses.filter(e => {
      if (!e.date) return false;
      const parts = e.date.split('-');
      const d = parseInt(parts[2], 10);
      return d === selectedDayOfMonth;
    });
  }, [selectedDayOfMonth, data?.expenses]);

  // Expenses for a specific week
  const getExpensesForWeek = (w: UserWeekStat) => {
    if (!data?.expenses) return [];
    return data.expenses.filter(e => {
      if (!e.date) return false;
      return e.date >= w.startDate && e.date <= w.endDate;
    });
  };

  // Archive filtered expenses
  const filteredExpenses = useMemo(() => {
    if (!data?.expenses) return [];
    if (!searchQuery.trim()) return data.expenses;
    const q = searchQuery.toLowerCase().trim();
    return data.expenses.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        e.tripName.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.paidByName.toLowerCase().includes(q)
    );
  }, [data?.expenses, searchQuery]);

  // Current week's 7 daily breakdowns for week-wise heatmap
  const weekHeatmapDays = useMemo(() => {
    if (!data?.currentWeek) return [];
    const ws = data.currentWeek.startDate;
    const we = data.currentWeek.endDate;
    if (!ws || !we) return [];

    const start = new Date(ws);
    const days: { dateStr: string; dayName: string; dayNum: number; sharePaise: number; count: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const iso = cur.toISOString().substring(0, 10);
      const dayName = WEEKDAY_NAMES[(cur.getDay() + 6) % 7];
      const match = data.byDay?.find(d => d.date === iso);

      days.push({
        dateStr: iso,
        dayName,
        dayNum: cur.getDate(),
        sharePaise: match ? match.personalSharePaise : 0,
        count: match ? match.count : 0,
      });
    }
    return days;
  }, [data?.currentWeek, data?.byDay]);

  if (analyticsQuery.isLoading) return <Loading />;
  if (analyticsQuery.isError) {
    return (
      <ErrorState
        message={errorMessage(analyticsQuery.error)}
        onRetry={() => analyticsQuery.refetch()}
      />
    );
  }

  // Active days count & highest day
  const activeDaysCount = data?.byDay?.filter(d => d.personalSharePaise > 0).length ?? 0;
  const highestDay = data?.byDay?.slice().sort((a, b) => b.personalSharePaise - a.personalSharePaise)[0];

  // Calendar cell width calculation
  const calendarInnerWidth = screenWidth - 32 - 32; // Screen padding 16*2, card padding 16*2
  const cellWidth = Math.floor((calendarInnerWidth - 6 * 6) / 7);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, 16) + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={analyticsQuery.isRefetching}
            onRefresh={() => {
              analyticsQuery.refetch();
            }}
          />
        }
      >
        {/* Month Selector Bar */}
        <View style={styles.monthSelectorSection}>
          <View style={styles.monthHeaderRow}>
            <View>
              <Text style={styles.sectionSubtitle}>FINANCIAL ANALYTICS & ARCHIVE</Text>
              <Text style={styles.monthTitle}>
                {formatMonthLabel(currentMonth)}{' '}
                {isCurrentCalendarMonth && <Text style={styles.currentMonthBadge}>• CURRENT</Text>}
              </Text>
            </View>
            <View style={styles.savedPill}>
              <Ionicons name="shield-checkmark" size={13} color="#10B981" />
              <Text style={styles.savedPillText}>Saved & Preserved</Text>
            </View>
          </View>

          {/* Month selector chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthChipsRow}
          >
            {(data?.availableMonths || [currentMonth]).map(m => {
              const active = m === currentMonth;
              return (
                <Pressable
                  key={m}
                  style={[styles.monthChip, active && styles.monthChipActive]}
                  onPress={() => {
                    setSelectedMonth(m);
                    setSelectedDayOfMonth(null);
                  }}
                >
                  <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
                    {formatMonthLabel(m)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Executive Summary Obsidian Card */}
        <View style={styles.heroSummaryCard}>
          <View style={styles.heroHeaderRow}>
            <View>
              <Text style={styles.heroSummaryLabel}>TOTAL MONTHLY SHARE</Text>
              <Text style={styles.heroAmount}>{formatPaise(data?.myPersonalSharePaise ?? 0, 'INR')}</Text>
            </View>
            <View style={styles.heroTxnCountBadge}>
              <Ionicons name="receipt-outline" size={13} color="#FFFFFF" />
              <Text style={styles.heroTxnCountText}>{data?.totalExpensesCount ?? 0} txns</Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroSubGrid}>
            <View style={styles.heroSubCol}>
              <Text style={styles.heroSubLabel}>GROUP TURNOVER</Text>
              <Text style={styles.heroSubVal}>{formatPaise(data?.groupTotalPaise ?? 0, 'INR')}</Text>
            </View>
            <View style={styles.heroSubCol}>
              <Text style={styles.heroSubLabel}>ACTIVE TRIPS</Text>
              <Text style={styles.heroSubVal}>{data?.activeTripsCount ?? 0} trips</Text>
            </View>
            <View style={[styles.heroSubCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.heroSubLabel}>DAILY AVERAGE</Text>
              <Text style={styles.heroSubVal}>
                {formatPaise(
                  Math.round((data?.myPersonalSharePaise ?? 0) / Math.max(1, daysInMonth)),
                  'INR'
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Spacious Sub Navigation Segmented Tabs */}
        <View style={styles.subNavBar}>
          <Pressable
            style={[styles.subNavBtn, activeTab === 'day' && styles.subNavBtnActive]}
            onPress={() => setActiveTab('day')}
          >
            <Ionicons
              name={activeTab === 'day' ? 'grid' : 'grid-outline'}
              size={16}
              color={activeTab === 'day' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subNavBtnText, activeTab === 'day' && styles.subNavBtnTextActive]}>
              Heatmap
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, activeTab === 'week' && styles.subNavBtnActive]}
            onPress={() => setActiveTab('week')}
          >
            <Ionicons
              name={activeTab === 'week' ? 'stats-chart' : 'stats-chart-outline'}
              size={16}
              color={activeTab === 'week' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subNavBtnText, activeTab === 'week' && styles.subNavBtnTextActive]}>
              Week-Wise
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, activeTab === 'month' && styles.subNavBtnActive]}
            onPress={() => setActiveTab('month')}
          >
            <Ionicons
              name={activeTab === 'month' ? 'pie-chart' : 'pie-chart-outline'}
              size={16}
              color={activeTab === 'month' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subNavBtnText, activeTab === 'month' && styles.subNavBtnTextActive]}>
              Categories
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, activeTab === 'archive' && styles.subNavBtnActive]}
            onPress={() => setActiveTab('archive')}
          >
            <Ionicons
              name={activeTab === 'archive' ? 'list' : 'list-outline'}
              size={16}
              color={activeTab === 'archive' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.subNavBtnText, activeTab === 'archive' && styles.subNavBtnTextActive]}>
              Archive
            </Text>
          </Pressable>
        </View>

        {/* ─── TAB 1: HEATMAP (WITH WEEK-WISE & MONTH-WISE TOGGLE) ────────── */}
        {activeTab === 'day' && (
          <View style={styles.tabContent}>
            {/* Scope Toggle: Month-wise vs Week-wise Heatmap */}
            <View style={styles.heatmapToggleCard}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleTitle}>Heatmap View:</Text>
                <View style={styles.toggleSwitchContainer}>
                  <Pressable
                    style={[
                      styles.togglePill,
                      heatmapScope === 'month' && styles.togglePillActive,
                    ]}
                    onPress={() => {
                      setHeatmapScope('month');
                      setSelectedDayOfMonth(null);
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={heatmapScope === 'month' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.togglePillText,
                        heatmapScope === 'month' && styles.togglePillTextActive,
                      ]}
                    >
                      Month View
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.togglePill,
                      heatmapScope === 'week' && styles.togglePillActive,
                    ]}
                    onPress={() => {
                      setHeatmapScope('week');
                      setSelectedDayOfMonth(null);
                    }}
                  >
                    <Ionicons
                      name="today-outline"
                      size={13}
                      color={heatmapScope === 'week' ? '#FFFFFF' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.togglePillText,
                        heatmapScope === 'week' && styles.togglePillTextActive,
                      ]}
                    >
                      Week View
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Quick Metrics Bar */}
            <View style={styles.statsPillGrid}>
              <View style={styles.statsPillItem}>
                <Text style={styles.statsPillLabel}>Active Days</Text>
                <Text style={styles.statsPillVal}>{activeDaysCount} / {daysInMonth} days</Text>
              </View>
              <View style={styles.statsPillItem}>
                <Text style={styles.statsPillLabel}>Highest Day</Text>
                <Text style={styles.statsPillVal}>
                  {highestDay && highestDay.personalSharePaise > 0
                    ? `Day ${highestDay.dayOfMonth} (${formatPaise(highestDay.personalSharePaise, 'INR')})`
                    : '₹0.00'}
                </Text>
              </View>
            </View>

            {/* ── MODE A: MONTH-WISE HEATMAP CALENDAR GRID ── */}
            {heatmapScope === 'month' ? (
              <Card style={styles.heatmapCard}>
                <View style={styles.heatmapHeader}>
                  <Text style={styles.heatmapCardTitle}>Daily Money Spent Intensity</Text>
                  <Text style={styles.heatmapCardHint}>Tap any day to see breakdown</Text>
                </View>

                {/* Weekday headers: Mon - Sun */}
                <View style={styles.calendarWeekdayRow}>
                  {WEEKDAY_NAMES.map(w => (
                    <Text key={w} style={[styles.calendarWeekdayText, { width: cellWidth }]}>
                      {w}
                    </Text>
                  ))}
                </View>

                {/* 7-column day grid */}
                <View style={styles.calendarGrid}>
                  {/* Empty leading padding slots */}
                  {Array.from({ length: firstWeekdayIndex }).map((_, idx) => (
                    <View
                      key={`empty-${idx}`}
                      style={[styles.dayCellEmpty, { width: cellWidth, height: cellWidth }]}
                    />
                  ))}

                  {/* Day cells 1 to daysInMonth */}
                  {(data?.byDay || []).map(day => {
                    const isSelected = selectedDayOfMonth === day.dayOfMonth;
                    const bg = getHeatmapColor(day.personalSharePaise);
                    const isDark = day.personalSharePaise / maxDaySpend > 0.5;
                    return (
                      <TouchableOpacity
                        key={day.date}
                        style={[
                          styles.dayCell,
                          {
                            width: cellWidth,
                            height: cellWidth,
                            backgroundColor: bg,
                          },
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() =>
                          setSelectedDayOfMonth(
                            selectedDayOfMonth === day.dayOfMonth ? null : day.dayOfMonth
                          )
                        }
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.dayCellNum,
                            { color: isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {day.dayOfMonth}
                        </Text>
                        {day.count > 0 && (
                          <View
                            style={[
                              styles.dayCellDot,
                              { backgroundColor: isDark ? '#FFFFFF' : '#10B981' },
                            ]}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Heatmap Legend */}
                <View style={styles.legendRow}>
                  <Text style={styles.legendLabel}>Less</Text>
                  <View style={[styles.legendBox, { backgroundColor: '#F1F5F9' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#BBF7D0' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#4ADE80' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#16A34A' }]} />
                  <View style={[styles.legendBox, { backgroundColor: '#15803D' }]} />
                  <Text style={styles.legendLabel}>More</Text>
                </View>
              </Card>
            ) : (
              /* ── MODE B: WEEK-WISE HEATMAP ── */
              <Card style={styles.heatmapCard}>
                <View style={styles.heatmapHeader}>
                  <View>
                    <Text style={styles.heatmapCardTitle}>Current Week Day-by-Day</Text>
                    <Text style={styles.heatmapCardHint}>
                      {data?.currentWeek?.label || 'This Week'}
                    </Text>
                  </View>
                  <View style={styles.weekTotalPill}>
                    <Text style={styles.weekTotalPillText}>
                      {formatPaise(data?.currentWeek?.personalSharePaise ?? 0, 'INR')}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  {weekHeatmapDays.map(d => {
                    const pct =
                      (data?.currentWeek?.personalSharePaise ?? 0) > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (d.sharePaise / (data?.currentWeek?.personalSharePaise || 1)) * 100
                            )
                          )
                        : 0;
                    return (
                      <TouchableOpacity
                        key={d.dateStr}
                        style={styles.weekDayRow}
                        onPress={() => setSelectedDayOfMonth(d.dayNum)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.weekDayBadge}>
                          <Text style={styles.weekDayName}>{d.dayName}</Text>
                          <Text style={styles.weekDayNum}>{d.dayNum}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={styles.weekDayProgressRow}>
                            <Text style={styles.weekDayAmount}>
                              {formatPaise(d.sharePaise, 'INR')}
                            </Text>
                            <Text style={styles.weekDayCount}>{d.count} txns</Text>
                          </View>
                          <View style={styles.weekProgressBarBg}>
                            <View
                              style={[
                                styles.weekProgressBarFill,
                                {
                                  width: `${d.sharePaise > 0 ? Math.max(8, pct) : 0}%`,
                                  backgroundColor: getHeatmapColor(d.sharePaise),
                                },
                              ]}
                            />
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            )}

            {/* Selected Day Inspection Card */}
            {selectedDayOfMonth ? (
              <Card style={styles.dayDetailCard}>
                <View style={styles.dayDetailHeader}>
                  <View>
                    <Text style={styles.sectionSubtitle}>DAY {selectedDayOfMonth} DETAILS</Text>
                    <Text style={styles.dayDetailTitle}>
                      {selectedDayExpenses.length} transactions recorded
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedDayOfMonth(null)}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {selectedDayExpenses.length === 0 ? (
                  <Text style={styles.noDayTxnsText}>
                    No personal expenses logged on day {selectedDayOfMonth}.
                  </Text>
                ) : (
                  selectedDayExpenses.map(item => (
                    <View key={item.id} style={styles.txnRow}>
                      <View
                        style={[
                          styles.txnCatIcon,
                          { backgroundColor: (CATEGORY_COLORS[item.category] || '#6B7280') + '1A' },
                        ]}
                      >
                        <Ionicons
                          name={CATEGORY_ICONS[item.category] || 'receipt-outline'}
                          size={16}
                          color={CATEGORY_COLORS[item.category] || '#0F172A'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txnTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.txnSubtext}>
                          {item.tripName} • Paid by {item.isPaidByMe ? 'You' : item.paidByName}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.txnAmount}>{formatPaise(item.personalSharePaise, 'INR')}</Text>
                        <Text style={styles.txnGroupTotal}>Total: {formatPaise(item.amountPaise, 'INR')}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            ) : null}
          </View>
        )}

        {/* ─── TAB 2: WEEK-WISE (WITH INTERACTIVE WEEK BREAKDOWN) ─────────── */}
        {activeTab === 'week' && (
          <View style={styles.tabContent}>
            {/* Current Active Week Banner */}
            {data?.currentWeek && (
              <View style={styles.currentWeekCard}>
                <View style={styles.currentWeekTag}>
                  <View style={styles.currentWeekDot} />
                  <Text style={styles.currentWeekTagText}>
                    ACTIVE WEEK • {data.currentWeek.label.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.currentWeekContentRow}>
                  <View>
                    <Text style={styles.currentWeekAmountLabel}>YOUR WEEKLY SHARE</Text>
                    <Text style={styles.currentWeekAmount}>
                      {formatPaise(data.currentWeek.personalSharePaise, 'INR')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.currentWeekMeta}>
                      Group: {formatPaise(data.currentWeek.groupSpentPaise, 'INR')}
                    </Text>
                    <Text style={styles.currentWeekMeta}>
                      {data.currentWeek.count} txns logged
                    </Text>
                  </View>
                </View>
                <Text style={styles.currentWeekRange}>
                  Calculating since {data.currentWeek.startDate} to {data.currentWeek.endDate}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionSubtitle, { marginTop: space.md, marginBottom: space.xs }]}>
              CALENDAR WEEKS
            </Text>

            {(data?.byWeek || []).map(w => {
              const isExpanded = expandedWeekNumber === w.weekNumber;
              const weekExpenses = isExpanded ? getExpensesForWeek(w) : [];
              const weekPct =
                (data?.myPersonalSharePaise ?? 0) > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (w.personalSharePaise / (data?.myPersonalSharePaise || 1)) * 100
                      )
                    )
                  : 0;

              return (
                <Card key={w.weekNumber} style={styles.weekCard}>
                  <TouchableOpacity
                    style={styles.weekCardTop}
                    onPress={() =>
                      setExpandedWeekNumber(isExpanded ? null : w.weekNumber)
                    }
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, paddingRight: space.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.weekLabel}>{w.label}</Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color="#64748B"
                        />
                      </View>
                      <Text style={styles.weekDates}>
                        {w.startDate} to {w.endDate} • {w.count} transactions
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.weekShareAmount}>{formatPaise(w.personalSharePaise, 'INR')}</Text>
                      <Text style={styles.weekGroupAmount}>Group: {formatPaise(w.groupSpentPaise, 'INR')}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Progress bar of week spend vs monthly personal share */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${weekPct}%`,
                          backgroundColor: '#10B981',
                        },
                      ]}
                    />
                  </View>

                  {/* EXPANDED WEEK BREAKDOWN */}
                  {isExpanded && (
                    <View style={styles.weekExpandedContainer}>
                      <View style={styles.weekExpandedHeader}>
                        <Text style={styles.weekExpandedTitle}>
                          Week {w.weekNumber} Transactions Breakdown ({weekExpenses.length})
                        </Text>
                      </View>

                      {weekExpenses.length === 0 ? (
                        <Text style={styles.noWeekTxnsText}>
                          No transactions recorded during this week.
                        </Text>
                      ) : (
                        weekExpenses.map(item => (
                          <View key={item.id} style={styles.txnRow}>
                            <View
                              style={[
                                styles.txnCatIcon,
                                { backgroundColor: (CATEGORY_COLORS[item.category] || '#6B7280') + '1A' },
                              ]}
                            >
                              <Ionicons
                                name={CATEGORY_ICONS[item.category] || 'receipt-outline'}
                                size={15}
                                color={CATEGORY_COLORS[item.category] || '#0F172A'}
                              />
                            </View>
                            <View style={{ flex: 1, paddingRight: space.xs }}>
                              <Text style={styles.txnTitle} numberOfLines={1}>{item.title}</Text>
                              <Text style={styles.txnSubtext}>
                                {item.date} • {item.tripName}
                              </Text>
                              <Text style={styles.payerTag}>
                                Paid by: {item.isPaidByMe ? 'You' : item.paidByName}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.txnAmount}>
                                {formatPaise(item.personalSharePaise, 'INR')}
                              </Text>
                              <Text style={styles.txnGroupTotal}>
                                Total: {formatPaise(item.amountPaise, 'INR')}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── TAB 3: CATEGORIES & TRIPS BREAKDOWN ────────────────────────── */}
        {activeTab === 'month' && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionSubtitle, { marginBottom: space.xs }]}>
              CATEGORY-WISE PERSONAL VS GROUP SPEND
            </Text>

            {(data?.byCategory || []).map(cat => (
              <Card key={cat.category} style={styles.catCard}>
                <View style={styles.catRow}>
                  <View
                    style={[
                      styles.catIconCircle,
                      { backgroundColor: (CATEGORY_COLORS[cat.category] || '#6B7280') + '1A' },
                    ]}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[cat.category] || 'receipt-outline'}
                      size={18}
                      color={CATEGORY_COLORS[cat.category] || '#0F172A'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catTitle}>{cat.category}</Text>
                    <Text style={styles.catCount}>{cat.count} transactions</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.catShareAmount}>
                      {formatPaise(cat.personalSharePaise, 'INR')}{' '}
                      <Text style={styles.catPct}>({cat.personalPercentage}%)</Text>
                    </Text>
                    <Text style={styles.catGroupAmount}>
                      Group: {formatPaise(cat.groupSpentPaise, 'INR')}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, cat.personalPercentage)}%`,
                        backgroundColor: CATEGORY_COLORS[cat.category] || '#10B981',
                      },
                    ]}
                  />
                </View>
              </Card>
            ))}

            <Text style={[styles.sectionSubtitle, { marginTop: space.lg, marginBottom: space.xs }]}>
              TRIP-WISE BREAKDOWN ({data?.byTrip?.length ?? 0} TRIPS)
            </Text>

            {(data?.byTrip || []).length === 0 ? (
              <EmptyState title="No active trips" hint="No expenses recorded in any trip this month." />
            ) : (
              (data?.byTrip || []).map(trip => (
                <TouchableOpacity
                  key={trip.tripId}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('Trip', { tripId: trip.tripId })}
                >
                  <Card style={styles.tripCard}>
                    <View style={styles.tripCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tripName} numberOfLines={1}>{trip.tripName}</Text>
                        <Text style={styles.tripDest}>{trip.destination || 'Trip'} • {trip.count} expenses</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </View>
                    <View style={styles.tripCardStats}>
                      <View>
                        <Text style={styles.tripStatLabel}>My Share</Text>
                        <Text style={styles.tripStatVal}>{formatPaise(trip.personalSharePaise, trip.currency)}</Text>
                      </View>
                      <View>
                        <Text style={styles.tripStatLabel}>Group Total</Text>
                        <Text style={styles.tripStatVal}>{formatPaise(trip.groupSpentPaise, trip.currency)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.tripStatLabel}>I Paid</Text>
                        <Text style={styles.tripStatVal}>{formatPaise(trip.myPaidPaise, trip.currency)}</Text>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ─── TAB 4: ARCHIVE & ALL TRANSACTIONS ─────────────────────────── */}
        {activeTab === 'archive' && (
          <View style={styles.tabContent}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by title, trip, payer, category..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.sectionSubtitle, { marginVertical: space.xs }]}>
              TRANSACTIONS IN {formatMonthLabel(currentMonth).toUpperCase()} ({filteredExpenses.length})
            </Text>

            {filteredExpenses.length === 0 ? (
              <EmptyState title="No transactions" hint="No expenses match your search query." />
            ) : (
              filteredExpenses.map(item => (
                <Card key={item.id} style={styles.archiveTxnCard}>
                  <View style={styles.txnRow}>
                    <View
                      style={[
                        styles.txnCatIcon,
                        { backgroundColor: (CATEGORY_COLORS[item.category] || '#6B7280') + '1A' },
                      ]}
                    >
                      <Ionicons
                        name={CATEGORY_ICONS[item.category] || 'receipt-outline'}
                        size={18}
                        color={CATEGORY_COLORS[item.category] || '#0F172A'}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: space.xs }}>
                      <Text style={styles.txnTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.txnSubtext}>
                        {item.date} • {item.tripName}
                      </Text>
                      <Text style={styles.payerTag}>
                        Paid by: {item.isPaidByMe ? 'You' : item.paidByName}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.archivePersonalShare}>
                        {formatPaise(item.personalSharePaise, 'INR')}
                      </Text>
                      <Text style={styles.archiveGroupTotal}>
                        Total: {formatPaise(item.amountPaise, 'INR')}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: space.md,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  monthSelectorSection: {
    marginBottom: space.md,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  currentMonthBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  savedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  monthChipsRow: {
    gap: space.xs,
    paddingVertical: space.xs,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.sm,
  },
  monthChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Obsidian Hero Card
  heroSummaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.md,
    ...shadows.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSummaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroTxnCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTxnCountText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: space.md,
  },
  heroSubGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroSubCol: {
    flex: 1,
  },
  heroSubLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  heroSubVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },

  // Spacious Sub Navigation Segmented Tabs
  subNavBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: space.md,
    gap: 4,
  },
  subNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  subNavBtnActive: {
    backgroundColor: '#10B981',
    ...shadows.sm,
  },
  subNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  subNavBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  tabContent: {
    gap: space.sm,
  },

  // Heatmap View Toggle Card
  heatmapToggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: space.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
  },
  toggleSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: radius.full,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  togglePillActive: {
    backgroundColor: '#10B981',
  },
  togglePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  togglePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Stats Pill Grid
  statsPillGrid: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.xs,
  },
  statsPillItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsPillLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  statsPillVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },

  // Heatmap Card & Calendar Grid
  heatmapCard: {
    padding: space.md,
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  heatmapCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  heatmapCardHint: {
    fontSize: 11,
    color: '#64748B',
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 4,
  },
  calendarWeekdayText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    borderRadius: radius.sm,
  },
  dayCell: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayCellSelected: {
    borderColor: '#0F172A',
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
    zIndex: 10,
  },
  dayCellNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayCellDot: {
    position: 'absolute',
    bottom: 2.5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: space.md,
    paddingTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },

  // Week-wise Heatmap Row
  weekTotalPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  weekTotalPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  weekDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  weekDayBadge: {
    width: 44,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  weekDayNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  weekDayProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekDayAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekDayCount: {
    fontSize: 11,
    color: '#64748B',
  },
  weekProgressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  weekProgressBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Day Inspection Card
  dayDetailCard: {
    marginTop: space.xs,
    padding: space.md,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.sm,
  },
  dayDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  noDayTxnsText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    paddingVertical: space.sm,
  },

  // Transactions item row
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txnCatIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  txnSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  payerTag: {
    fontSize: 10.5,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  txnAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  txnGroupTotal: {
    fontSize: 10,
    color: '#64748B',
  },

  // Current Week Card
  currentWeekCard: {
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    padding: space.md,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    ...shadows.sm,
  },
  currentWeekTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentWeekDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  currentWeekTagText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currentWeekContentRow: {
    marginTop: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentWeekAmountLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  currentWeekAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  currentWeekMeta: {
    fontSize: 11,
    color: '#94A3B8',
  },
  currentWeekRange: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: space.sm,
    fontStyle: 'italic',
  },

  // Week Cards
  weekCard: {
    padding: space.md,
  },
  weekCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekDates: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  weekShareAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  weekGroupAmount: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: radius.full,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Week Expanded Breakdown
  weekExpandedContainer: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  weekExpandedHeader: {
    marginBottom: space.xs,
  },
  weekExpandedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.4,
  },
  noWeekTxnsText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    paddingVertical: space.sm,
  },

  // Category Cards
  catCard: {
    padding: space.md,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  catCount: {
    fontSize: 11,
    color: '#64748B',
  },
  catShareAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  catPct: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  catGroupAmount: {
    fontSize: 10.5,
    color: '#64748B',
  },

  // Trip Cards
  tripCard: {
    padding: space.md,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  tripName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  tripDest: {
    fontSize: 11.5,
    color: '#64748B',
  },
  tripCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: space.xs,
  },
  tripStatLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  tripStatVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },

  // Archive & Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: space.xs,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  archiveTxnCard: {
    padding: space.sm,
  },
  archivePersonalShare: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  archiveGroupTotal: {
    fontSize: 10.5,
    color: '#64748B',
  },
});
