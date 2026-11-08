import React, { useEffect } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { EmptyState, ErrorState, Loading } from '../components/ui';
import { colors, radius, shadows, space, type } from '../theme';
import { formatWhen } from '../utils/format';
import type { Props } from '../navigation/types';
import type { AppNotification } from '../api/types';

function getNotificationMeta(msg: string, isUnread: boolean): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  badgeLabel: string;
} {
  const lower = msg.toLowerCase();
  if (lower.includes('settled') || lower.includes('repaid') || lower.includes('payment')) {
    return {
      icon: 'checkmark-circle',
      iconColor: isUnread ? '#10B981' : '#94A3B8',
      iconBg: isUnread ? '#D1FAE5' : '#F1F5F9',
      badgeLabel: 'SETTLEMENT',
    };
  }
  if (lower.includes('expense') || lower.includes('added') || lower.includes('spent') || lower.includes('₹') || lower.includes('$')) {
    return {
      icon: 'receipt',
      iconColor: isUnread ? '#0D382A' : '#94A3B8',
      iconBg: isUnread ? '#E8F5EF' : '#F1F5F9',
      badgeLabel: 'EXPENSE',
    };
  }
  if (lower.includes('joined') || lower.includes('request') || lower.includes('member')) {
    return {
      icon: 'person-add',
      iconColor: isUnread ? '#2563EB' : '#94A3B8',
      iconBg: isUnread ? '#EFF6FF' : '#F1F5F9',
      badgeLabel: 'MEMBER',
    };
  }
  if (lower.includes('comment') || lower.includes('query') || lower.includes('note')) {
    return {
      icon: 'chatbubble-ellipses',
      iconColor: isUnread ? '#D97706' : '#94A3B8',
      iconBg: isUnread ? '#FEF3C7' : '#F1F5F9',
      badgeLabel: 'CHAT',
    };
  }
  return {
    icon: 'notifications',
    iconColor: isUnread ? colors.primary : '#94A3B8',
    iconBg: isUnread ? colors.primarySoft : '#F1F5F9',
    badgeLabel: 'UPDATE',
  };
}

export default function NotificationsScreen({ navigation }: Props<'Notifications'>) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications.list });

  // Opening the screen marks everything as read
  useEffect(() => {
    if (q.data && q.data.unread > 0) {
      endpoints.notifications
        .readAll()
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
  }, [q.data, qc]);

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;

  const unreadCount = q.data.unread ?? 0;
  const items = q.data.items ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => {
              q.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <View style={styles.headerTitleRow}>
              <View>
                <Text style={type.caption}>UPDATES & ACTIVITY</Text>
                <Text style={styles.headerTitle}>Notifications</Text>
              </View>
              {unreadCount > 0 ? (
                <View style={styles.unreadStatusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.unreadStatusText}>{unreadCount} NEW</Text>
                </View>
              ) : (
                <View style={styles.caughtUpBadge}>
                  <Ionicons name="checkmark-done" size={14} color="#059669" />
                  <Text style={styles.caughtUpText}>Caught Up</Text>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="All caught up"
            hint="You'll be notified here when friends add expenses, join trips, or settle balances."
          />
        }
        renderItem={({ item }: { item: AppNotification }) => {
          const isUnread = !item.seen;
          const meta = getNotificationMeta(item.message, isUnread);

          return (
            <Pressable
              onPress={() => {
                if (item.tripId) navigation.navigate('Trip', { tripId: item.tripId });
              }}
              style={({ pressed }) => [
                styles.card,
                isUnread ? styles.cardUnread : styles.cardRead,
                pressed && styles.cardPressed,
              ]}
            >
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: meta.iconBg }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.iconColor} />
              </View>

              {/* Text content */}
              <View style={styles.cardContent}>
                <View style={styles.metaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: meta.iconBg }]}>
                      <Text style={[styles.badgeText, { color: meta.iconColor }]}>{meta.badgeLabel}</Text>
                    </View>
                    {isUnread && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.timeText, isUnread && styles.timeTextUnread]}>
                    {formatWhen(item.createdAt)}
                  </Text>
                </View>

                <Text style={[styles.messageText, isUnread ? styles.messageTextUnread : styles.messageTextRead]}>
                  {item.message}
                </Text>

                {item.tripId ? (
                  <View style={styles.tripLinkRow}>
                    <Text style={[styles.tripLinkText, !isUnread && { color: colors.muted }]}>Open Trip</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={13}
                      color={isUnread ? colors.primary : colors.muted}
                    />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    padding: space.lg,
    paddingTop: space.sm,
    paddingBottom: 40,
    flexGrow: 1,
  },
  headerBox: {
    marginBottom: space.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  unreadStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  unreadStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.dangerDark,
    letterSpacing: 0.5,
  },
  caughtUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  caughtUpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },

  // ── Card styles: Clear difference between unread and read ──
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
  },
  cardUnread: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderLeftWidth: 5,
    borderLeftColor: '#0D382A',
    shadowColor: '#0D382A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRead: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.lineLight,
    borderLeftWidth: 1,
    borderLeftColor: colors.lineLight,
    opacity: 0.88,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  newBadge: {
    backgroundColor: '#D4FF00',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#9EB800',
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#08251C',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 11.5,
    color: colors.muted,
    fontWeight: '500',
  },
  timeTextUnread: {
    color: '#065F46',
    fontWeight: '700',
  },
  messageText: {
    lineHeight: 20,
  },
  messageTextUnread: {
    fontSize: 14.5,
    color: '#0A1813',
    fontWeight: '700',
  },
  messageTextRead: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '400',
  },
  tripLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space.xs,
  },
  tripLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
});
