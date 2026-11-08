import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Chip, EmptyState, ErrorState, Loading, getCuteAvatar } from '../components/ui';
import { colors, radius, shadows, space, type } from '../theme';
import { formatDate } from '../utils/format';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';
import type { TripSummary } from '../api/types';

// ─── Status helpers ──────────────────────────────────────────────────────────
function getTripStatus(trip: TripSummary): 'upcoming' | 'ongoing' | 'settled' {
  if (trip.status === 'SETTLED') return 'settled';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (trip.startDate) {
    const start = new Date(trip.startDate);
    start.setHours(0, 0, 0, 0);
    if (start > today) return 'upcoming';
  }
  if (trip.endDate) {
    const end = new Date(trip.endDate);
    end.setHours(0, 0, 0, 0);
    if (end < today) return 'ongoing';
  }
  return 'ongoing';
}

function StatusChip({ status }: { status: 'upcoming' | 'ongoing' | 'settled' }) {
  if (status === 'upcoming')
    return <Chip label="Upcoming" tone="accent" icon="time-outline" />;
  if (status === 'ongoing')
    return <Chip label="Active" tone="good" icon="radio-button-on-outline" />;
  return <Chip label="Settled" tone="warn" icon="checkmark-circle-outline" />;
}

// ─── Overlapping Avatar Stack ────────────────────────────────────────────────
function AvatarStack({ count, seed }: { count: number; seed: string }) {
  const displayCount = Math.min(Math.max(count, 1), 3);
  const sampleNames = ['Alex', 'Sam', 'Taylor', 'Jordan', 'Morgan'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {Array.from({ length: displayCount }).map((_, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            borderWidth: 2,
            borderColor: colors.card,
            borderRadius: 14,
          }}
        >
          <Avatar name={`${seed}_${sampleNames[i % sampleNames.length]}`} size={24} />
        </View>
      ))}
      {count > 3 && (
        <View
          style={{
            marginLeft: -8,
            backgroundColor: colors.lineLight,
            borderRadius: 14,
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.card,
          }}
        >
          <Text style={{ fontSize: 9.5, fontWeight: '700', color: colors.muted }}>+{count - 3}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Modern Velto Trip Card ──────────────────────────────────────────────────
function TripCard({ item, onPress }: { item: TripSummary; onPress: () => void }) {
  const status = getTripStatus(item);
  const isSettled = status === 'settled';

  const subtitle = [
    item.destination,
    item.startDate ? formatDate(item.startDate) : null,
    item.endDate && item.endDate !== item.startDate ? `– ${formatDate(item.endDate)}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.tripCard,
            isSettled && styles.tripCardSettled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          {/* Card Top Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <StatusChip status={status} />
                {item.owner && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>OWNER</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tripCardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              {subtitle ? (
                <Text style={styles.tripCardSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {/* Spent Pill */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tripCardAmountLabel}>TOTAL SPENT</Text>
              <Text style={[styles.tripCardAmount, isSettled && { color: colors.muted }]}>
                {formatPaise(item.totalSpentPaise, item.currency)}
              </Text>
            </View>
          </View>

          {/* Card Bottom Row */}
          <View style={styles.tripCardFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AvatarStack count={item.memberCount} seed={item.name} />
              <Text style={styles.memberCountText}>
                {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.viewTripText}>Open</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── Floating Action Button ──────────────────────────────────────────────────
function FAB({ onNewTrip, onJoin }: { onNewTrip: () => void; onJoin: () => void }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = (nextState?: boolean) => {
    const target = typeof nextState === 'boolean' ? nextState : !open;
    setOpen(target);
    Animated.timing(anim, {
      toValue: target ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const rotateInterp = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const translateYNew = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });

  const translateYJoin = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const opacityInterp = anim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0, 1],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const FabOption = ({
    label,
    icon,
    translateY,
    onPress,
    color = colors.primary,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    translateY: Animated.AnimatedInterpolation<number>;
    onPress: () => void;
    color?: string;
  }) => (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[
        styles.fabOptionRow,
        {
          transform: [{ translateY }],
          opacity: opacityInterp,
        },
      ]}
    >
      <View style={styles.fabOptionLabelBox}>
        <Text style={[styles.fabOptionLabelText, { color }]}>{label}</Text>
      </View>
      <TouchableOpacity
        onPress={() => {
          toggle(false);
          onPress();
        }}
        style={[styles.fabOptionCircle, { backgroundColor: color }]}
        activeOpacity={0.85}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <>
      {/* Animated backdrop */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(9, 24, 18, 0.45)',
            opacity: backdropOpacity,
            zIndex: 90,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => toggle(false)} />
      </Animated.View>

      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Option: New Trip */}
        <FabOption
          label="New trip"
          icon="add-circle-outline"
          translateY={translateYNew}
          onPress={onNewTrip}
          color={colors.primary}
        />

        {/* Option: Join trip */}
        <FabOption
          label="Join with code"
          icon="key-outline"
          translateY={translateYJoin}
          onPress={onJoin}
          color={colors.accent}
        />

        {/* Main FAB */}
        <TouchableOpacity
          onPress={() => toggle()}
          activeOpacity={0.9}
          style={styles.mainFabButton}
        >
          <Animated.View style={{ transform: [{ rotate: rotateInterp }] }}>
            <Ionicons name="add" size={30} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Main Dashboard Screen ───────────────────────────────────────────────────
export default function TripsScreen({ navigation }: Props<'Trips'>) {
  const { user } = useAuth();
  const tripsQuery = useQuery({ queryKey: ['trips'], queryFn: endpoints.trips.list });
  const notesQuery = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications.list });
  
  const [dashboardTab, setDashboardTab] = useState<'tripsplit' | 'stats'>('tripsplit');
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'settled'>('all');

  const trips = tripsQuery.data ?? [];
  const unread = notesQuery.data?.unread ?? 0;

  // Analytics Computations
  const totalSpent = trips.reduce((sum, t) => sum + (t.totalSpentPaise || 0), 0);
  const activeTrips = trips.filter(t => t.status === 'ACTIVE').length;
  const settledTrips = trips.filter(t => t.status === 'SETTLED').length;
  const totalMembersCount = trips.reduce((sum, t) => sum + (t.memberCount || 0), 0);

  // Filtered trips
  const filteredTrips = trips.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'ongoing') return t.status === 'ACTIVE';
    if (filter === 'settled') return t.status === 'SETTLED';
    return true;
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // We render our own premium Velto dashboard header
    });
  }, [navigation]);

  if (tripsQuery.isLoading) return <Loading />;
  if (tripsQuery.isError) {
    return <ErrorState message={errorMessage(tripsQuery.error)} onRetry={() => tripsQuery.refetch()} />;
  }

  const userFirstName = (user?.name || 'Explorer').split(' ')[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={tripsQuery.isRefetching}
            onRefresh={() => {
              tripsQuery.refetch();
              notesQuery.refetch();
            }}
          />
        }
      >
        {/* Top Header & Profile Glimpse */}
        <View style={styles.topHeader}>
          <Pressable
            style={styles.profileGlimpse}
            onPress={() => navigation.navigate('Profile')}
          >
            <Avatar name={user?.name || 'User'} size={42} />
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.greetingSmall}>Dashboard</Text>
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.greetingName}>{userFirstName}</Text>
            </View>
          </Pressable>

          <View style={styles.headerActionRow}>
            {/* Notifications Pill */}
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={colors.ink} />
              {unread > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </Pressable>

            {/* Profile Button */}
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Profile"
            >
              <Ionicons name="settings-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {dashboardTab === 'tripsplit' ? (
          <>
            {/* 2. Hero Card: Velto Virtual Credit Card UI */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.chipGraphic}>
                    <View style={styles.chipInnerGrid} />
                  </View>
                  <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: '90deg' }] }} />
                </View>
                <View style={styles.heroTag}>
                  <View style={styles.voltPillDot} />
                  <Text style={styles.heroTagText}>TRIPSPLIT PASS</Text>
                </View>
              </View>

              <View style={styles.heroAmountContainer}>
                <Text style={styles.heroAmountLabel}>PORTFOLIO SPEND</Text>
                <Text style={styles.heroBalanceAmount}>{formatPaise(totalSpent, 'INR')}</Text>
              </View>

              {/* Cardholder & Masked digits */}
              <View style={styles.cardMidDetails}>
                <View>
                  <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                  <Text style={styles.cardHolderName} numberOfLines={1}>
                    {(user?.name || 'EXPLORER').toUpperCase()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardNumberMasked}>•••• 8820</Text>
                  <Text style={styles.cardExpiryText}>{activeTrips} ACTIVE TRIPS</Text>
                </View>
              </View>

              {/* Quick Action Buttons inside Card */}
              <View style={styles.quickActionRow}>
                <TouchableOpacity
                  style={styles.quickActionPrimary}
                  onPress={() => navigation.navigate('CreateTrip')}
                  activeOpacity={0.88}
                >
                  <Ionicons name="add" size={18} color="#08251C" />
                  <Text style={styles.quickActionPrimaryText}>New Trip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionSecondary}
                  onPress={() => navigation.navigate('Join')}
                  activeOpacity={0.88}
                >
                  <Ionicons name="key-outline" size={16} color="#D4FF00" />
                  <Text style={styles.quickActionSecondaryText}>Join Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionGhost}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.88}
                >
                  <Ionicons name="card-outline" size={16} color="#fff" />
                  <Text style={styles.quickActionGhostText}>Pass</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Analytics & Financial Pulse Overview */}
            <View style={styles.sectionHeader}>
              <Text style={type.caption}>FINANCIAL PULSE</Text>
              <Text style={styles.analyticsSubtext}>Real-time breakdown</Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <View style={[styles.metricIconCircle, { backgroundColor: colors.goodSoft }]}>
                  <Ionicons name="flash-outline" size={16} color={colors.good} />
                </View>
                <Text style={styles.metricNumber}>{activeTrips}</Text>
                <Text style={styles.metricLabel}>Active Trips</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconCircle, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="people-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.metricNumber}>{totalMembersCount}</Text>
                <Text style={styles.metricLabel}>Connected</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconCircle, { backgroundColor: colors.warnSoft }]}>
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.warn} />
                </View>
                <Text style={styles.metricNumber}>{settledTrips}</Text>
                <Text style={styles.metricLabel}>Settled</Text>
              </View>
            </View>

            {/* 4. Trips Section with Filter Tabs */}
            <View style={[styles.sectionHeader, { marginTop: space.lg }]}>
              <Text style={type.caption}>YOUR TRIPS ({trips.length})</Text>
              <View style={styles.filterTabs}>
                <Pressable
                  style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                  onPress={() => setFilter('all')}
                >
                  <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>All</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterTab, filter === 'ongoing' && styles.filterTabActive]}
                  onPress={() => setFilter('ongoing')}
                >
                  <Text style={[styles.filterTabText, filter === 'ongoing' && styles.filterTabTextActive]}>Active</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterTab, filter === 'settled' && styles.filterTabActive]}
                  onPress={() => setFilter('settled')}
                >
                  <Text style={[styles.filterTabText, filter === 'settled' && styles.filterTabTextActive]}>Settled</Text>
                </Pressable>
              </View>
            </View>

            {filteredTrips.length === 0 ? (
              <EmptyState
                title="No trips in this view"
                hint="Create a new trip or join a friend with an invite code."
              />
            ) : (
              filteredTrips.map(trip => (
                <TripCard
                  key={trip.id}
                  item={trip}
                  onPress={() => navigation.navigate('Trip', { tripId: trip.id })}
                />
              ))
            )}
          </>
        ) : (
          /* Expense Stats View with "Upcoming Module" Tag */
          <View style={styles.statsContainer}>
            <View style={styles.upcomingHeroCard}>
              <View style={styles.upcomingBadgeRow}>
                <View style={styles.upcomingBadge}>
                  <View style={styles.voltPillDot} />
                  <Text style={styles.upcomingBadgeText}>UPCOMING MODULE</Text>
                </View>
                <Ionicons name="sparkles" size={18} color="#D4FF00" />
              </View>

              <Text style={styles.upcomingTitle}>Total Expense Tracking & Analytics</Text>
              <Text style={styles.upcomingSubtitle}>
                Cross-trip spending intelligence, category breakdowns, visual cashflow timelines, and budget insights are currently in active development.
              </Text>

              <View style={styles.upcomingDivider} />

              <View style={styles.upcomingFeatureList}>
                <View style={styles.upcomingFeatureItem}>
                  <View style={[styles.upcomingFeatureIconCircle, { backgroundColor: 'rgba(212, 255, 0, 0.12)' }]}>
                    <Ionicons name="pie-chart-outline" size={18} color="#D4FF00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingFeatureTitle}>Category Spend Distribution</Text>
                    <Text style={styles.upcomingFeatureDesc}>Automated tagging for food, stay, flights, fuel, and entertainment across all trips.</Text>
                  </View>
                </View>

                <View style={styles.upcomingFeatureItem}>
                  <View style={[styles.upcomingFeatureIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                    <Ionicons name="trending-up-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingFeatureTitle}>Debt & Payback Velocity</Text>
                    <Text style={styles.upcomingFeatureDesc}>Track pending dues, who settles quickest, and net balance across your whole friend circle.</Text>
                  </View>
                </View>

                <View style={styles.upcomingFeatureItem}>
                  <View style={[styles.upcomingFeatureIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
                    <Ionicons name="receipt-outline" size={18} color="#F43F5E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingFeatureTitle}>Exportable Tax & Audit Reports</Text>
                    <Text style={styles.upcomingFeatureDesc}>One-click consolidated spreadsheets and PDF expense reports for company reimbursements.</Text>
                  </View>
                </View>
              </View>

              <View style={styles.upcomingCardFooter}>
                <Text style={styles.upcomingCardFooterText}>COMING SOON IN V2.1</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button (Active on TripSplit tab) */}
      {dashboardTab === 'tripsplit' && (
        <FAB
          onNewTrip={() => navigation.navigate('CreateTrip')}
          onJoin={() => navigation.navigate('Join')}
        />
      )}

      {/* Bottom Floating Navigation Dock */}
      <View style={styles.dashboardDock}>
        <TouchableOpacity
          style={[
            styles.dashboardDockBtn,
            dashboardTab === 'tripsplit' && styles.dashboardDockBtnActive,
          ]}
          onPress={() => setDashboardTab('tripsplit')}
          activeOpacity={0.85}
        >
          <Ionicons
            name={dashboardTab === 'tripsplit' ? 'airplane' : 'airplane-outline'}
            size={18}
            color={dashboardTab === 'tripsplit' ? '#08251C' : 'rgba(255,255,255,0.7)'}
          />
          <Text
            style={[
              styles.dashboardDockBtnText,
              dashboardTab === 'tripsplit' && styles.dashboardDockBtnTextActive,
            ]}
          >
            TripSplit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dashboardDockBtn,
            dashboardTab === 'stats' && styles.dashboardDockBtnActive,
          ]}
          onPress={() => setDashboardTab('stats')}
          activeOpacity={0.85}
        >
          <Ionicons
            name={dashboardTab === 'stats' ? 'stats-chart' : 'stats-chart-outline'}
            size={18}
            color={dashboardTab === 'stats' ? '#08251C' : 'rgba(255,255,255,0.7)'}
          />
          <Text
            style={[
              styles.dashboardDockBtnText,
              dashboardTab === 'stats' && styles.dashboardDockBtnTextActive,
            ]}
          >
            Expense Stats
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: space.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : space.xl,
    paddingBottom: 110,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  profileGlimpse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  greetingSmall: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  greetingName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Hero Obsidian & Volt Card
  heroCard: {
    backgroundColor: '#0A1813',
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    shadowColor: '#071610',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: space.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGraphic: {
    width: 32,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#D1A354',
    borderWidth: 1,
    borderColor: '#F7D488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInnerGrid: {
    width: 18,
    height: 10,
    borderWidth: 1,
    borderColor: '#9E742A',
    borderRadius: 2,
  },
  heroAmountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
  },
  cardMidDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: space.md,
  },
  cardHolderLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardHolderName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardNumberMasked: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardExpiryText: {
    color: '#D4FF00',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  voltPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D4FF00',
  },
  heroTagText: {
    color: '#D4FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTripCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroAmountContainer: {
    marginTop: space.md,
    marginBottom: space.lg,
  },
  heroBalanceAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12.5,
    marginTop: 4,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: space.md,
  },
  quickActionPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#D4FF00',
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  quickActionPrimaryText: {
    color: '#08251C',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionSecondary: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.3)',
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  quickActionSecondaryText: {
    color: '#D4FF00',
    fontSize: 12.5,
    fontWeight: '700',
  },
  quickActionGhost: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  quickActionGhostText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Financial Pulse / Analytics
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
    paddingHorizontal: 2,
  },
  analyticsSubtext: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  metricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.lineLight,
    padding: 3,
    borderRadius: radius.full,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  filterTabActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  filterTabText: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Trip Cards
  tripCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  tripCardSettled: {
    backgroundColor: '#F5F5F3',
    borderColor: colors.line,
  },
  tripCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  tripCardSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 3,
  },
  tripCardAmountLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.subtle,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tripCardAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
  memberCountText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  viewTripText: {
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: '700',
  },
  ownerBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ownerBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.4,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    right: space.lg,
    bottom: Platform.OS === 'ios' ? 96 : 84,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  fabOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginBottom: space.sm,
  },
  fabOptionLabelBox: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    ...shadows.sm,
  },
  fabOptionLabelText: {
    fontWeight: '600',
    fontSize: 13.5,
  },
  fabOptionCircle: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...shadows.sm,
  },
  mainFabButton: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },

  // ─── Dashboard Bottom Navigation Dock ─────────────────────────────────────
  dashboardDock: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#0A1813',
    borderRadius: radius.full,
    padding: 5,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 90,
    gap: 6,
  },
  dashboardDockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  dashboardDockBtnActive: {
    backgroundColor: '#D4FF00',
  },
  dashboardDockBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  dashboardDockBtnTextActive: {
    color: '#08251C',
    fontWeight: '800',
  },

  // ─── Upcoming Module (Stats Tab) ──────────────────────────────────────────
  statsContainer: {
    marginTop: space.sm,
  },
  upcomingHeroCard: {
    backgroundColor: '#0A1813',
    borderRadius: radius.xl,
    padding: space.xl,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    shadowColor: '#071610',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 6,
  },
  upcomingBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 255, 0, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.35)',
  },
  upcomingBadgeText: {
    color: '#D4FF00',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  upcomingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: space.xs,
  },
  upcomingSubtitle: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  upcomingDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: space.lg,
  },
  upcomingFeatureList: {
    gap: space.md,
  },
  upcomingFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  upcomingFeatureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingFeatureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  upcomingFeatureDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 17,
  },
  upcomingCardFooter: {
    marginTop: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  upcomingCardFooterText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(212, 255, 0, 0.8)',
    letterSpacing: 1,
  },
});
