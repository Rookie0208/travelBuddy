import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
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
import { Card, Chip, EmptyState, ErrorState, Loading } from '../components/ui';
import { colors, radius, shadows, space, type } from '../theme';
import { formatDate } from '../utils/format';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';
import type { TripSummary } from '../api/types';

// ─── Trip status helpers ─────────────────────────────────────────────────────
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
    return <Chip label="Ongoing" tone="good" icon="radio-button-on-outline" />;
  return <Chip label="Settled" tone="warn" icon="checkmark-circle-outline" />;
}

// ─── Trip card ───────────────────────────────────────────────────────────────
function TripCard({ item, onPress }: { item: TripSummary; onPress: () => void }) {
  const status = getTripStatus(item);
  const isSettled = status === 'settled';

  const cardBg = isSettled ? '#F0EDE8' : colors.card;
  const nameFg = isSettled ? colors.muted : colors.ink;

  const subtitle = [
    item.destination,
    item.startDate ? formatDate(item.startDate) : null,
    item.endDate && item.endDate !== item.startDate ? `– ${formatDate(item.endDate)}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            {
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: space.lg,
              marginBottom: space.md,
              opacity: pressed ? 0.9 : 1,
              borderWidth: isSettled ? 1 : 0,
              borderColor: isSettled ? colors.line : 'transparent',
            },
            !isSettled && shadows.sm,
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={[type.heading, { color: nameFg }]} numberOfLines={1}>
                {item.name}
              </Text>
              {subtitle ? (
                <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : (
                <Text style={[type.small, { marginTop: 2 }]}>{item.memberCount} people</Text>
              )}
            </View>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: isSettled ? colors.muted : colors.ink,
              }}
            >
              {formatPaise(item.totalSpentPaise, item.currency)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md }}>
            <StatusChip status={status} />
            <Chip label={`${item.memberCount} people`} />
            {item.owner ? <Chip label="You own this" /> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── Floating action button ───────────────────────────────────────────────────
function FAB({ onNewTrip, onJoin }: { onNewTrip: () => void; onJoin: () => void }) {
  const [open, setOpen] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;
  const slideNew = useRef(new Animated.Value(0)).current;
  const slideJoin = useRef(new Animated.Value(0)).current;
  const fadeNew = useRef(new Animated.Value(0)).current;
  const fadeJoin = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(rotate, { toValue, useNativeDriver: true }),
      Animated.spring(slideNew, { toValue, useNativeDriver: true }),
      Animated.spring(slideJoin, { toValue, useNativeDriver: true }),
      Animated.timing(fadeNew, { toValue, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeJoin, { toValue, duration: 180, useNativeDriver: true }),
    ]).start();
    setOpen(o => !o);
  };

  const rotateInterp = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const translateNew = slideNew.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const translateJoin = slideJoin.interpolate({ inputRange: [0, 1], outputRange: [15, 0] });

  const FabOption = ({
    label,
    icon,
    translateY,
    opacity,
    onPress,
    color = colors.primary,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    translateY: Animated.AnimatedInterpolation<number>;
    opacity: Animated.Value;
    onPress: () => void;
    color?: string;
  }) => (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: space.sm,
          marginBottom: space.sm,
        },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View
        style={{
          backgroundColor: colors.card,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: radius.full,
          ...shadows.sm,
        }}
      >
        <Text style={{ fontWeight: '600', color, fontSize: 13.5 }}>{label}</Text>
      </View>
      <TouchableOpacity
        onPress={() => { toggle(); onPress(); }}
        style={{
          width: 46,
          height: 46,
          borderRadius: radius.full,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...shadows.sm,
        }}
        activeOpacity={0.85}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <>
      {/* Dimmed backdrop covering only the screen - zero overflow */}
      {open && (
        <Pressable
          onPress={toggle}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 90 },
          ]}
        />
      )}

      <View
        style={{
          position: 'absolute',
          right: space.lg,
          bottom: space.xl + 8,
          alignItems: 'flex-end',
          zIndex: 100,
        }}
        pointerEvents="box-none"
      >
        {/* Option: New Trip */}
        {open && (
          <FabOption
            label="New trip"
            icon="add-circle-outline"
            translateY={translateNew}
            opacity={fadeNew}
            onPress={onNewTrip}
            color={colors.primary}
          />
        )}

        {/* Option: Join trip */}
        {open && (
          <FabOption
            label="Join with code"
            icon="key-outline"
            translateY={translateJoin}
            opacity={fadeJoin}
            onPress={onJoin}
            color={colors.accent}
          />
        )}

        {/* Main FAB */}
        <TouchableOpacity
          onPress={toggle}
          activeOpacity={0.9}
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadows.md,
          }}
        >
          <Animated.View style={{ transform: [{ rotate: rotateInterp }] }}>
            <Ionicons name="add" size={28} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TripsScreen({ navigation }: Props<'Trips'>) {
  const { user } = useAuth();
  const trips = useQuery({ queryKey: ['trips'], queryFn: endpoints.trips.list });
  const notes = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications.list });
  const unread = notes.data?.unread ?? 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={colors.ink} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  right: -6,
                  top: -4,
                  backgroundColor: colors.danger,
                  borderRadius: 9,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Account Profile"
            hitSlop={8}
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, unread, user]);

  if (trips.isLoading) return <Loading />;
  if (trips.isError)
    return <ErrorState message={errorMessage(trips.error)} onRetry={() => trips.refetch()} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={trips.data}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 100, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={trips.isRefetching}
            onRefresh={() => { trips.refetch(); notes.refetch(); }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No trips yet"
            hint="Tap the + button below to create a trip or join one with a code."
          />
        }
        renderItem={({ item }) => (
          <TripCard
            item={item}
            onPress={() => navigation.navigate('Trip', { tripId: item.id })}
          />
        )}
      />

      {/* ── Floating action button ─────────────────────────────────── */}
      <FAB
        onNewTrip={() => navigation.navigate('CreateTrip')}
        onJoin={() => navigation.navigate('Join')}
      />
    </View>
  );
}
