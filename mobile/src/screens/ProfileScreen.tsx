import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Button, Card, Chip, ConfirmModal, PromptModal } from '../components/ui';
import { colors, radius, shadows, space, type } from '../theme';
import { capitalizeWords } from '../utils/format';
import { formatPaise } from '../utils/money';
import type { Props } from '../navigation/types';

export default function ProfileScreen({ navigation }: Props<'Profile'>) {
  const { user, updateUser, logout } = useAuth();
  const qc = useQueryClient();
  const tripsQuery = useQuery({ queryKey: ['trips'], queryFn: endpoints.trips.list });
  const notesQuery = useQuery({ queryKey: ['notifications'], queryFn: endpoints.notifications.list });

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const trips = tripsQuery.data ?? [];
  const totalSpent = trips.reduce((sum, t) => sum + (t.totalSpentPaise || 0), 0);
  const activeTrips = trips.filter((t) => t.status === 'ACTIVE').length;
  const unreadNotes = notesQuery.data?.unread ?? 0;

  const handleSaveName = async (newName: string) => {
    const formatted = capitalizeWords(newName.trim());
    if (!formatted) return;
    setBusy(true);
    try {
      const updated = await endpoints.auth.updateProfile(formatted);
      updateUser(updated);
      qc.invalidateQueries({ queryKey: ['trips'] });
      setFeedback('Profile name updated successfully.');
      setTimeout(() => setFeedback(''), 3000);
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {feedback ? (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.good} />
          <Text style={{ color: colors.good, fontWeight: '600', fontSize: 13.5 }}>{feedback}</Text>
        </View>
      ) : null}

      {/* User Info Card */}
      <Card style={styles.profileCard}>
        <View style={{ alignItems: 'center' }}>
          <Avatar name={user?.name ?? 'User'} size={72} />
          <Text style={[type.title, { marginTop: space.sm, textAlign: 'center' }]}>
            {user?.name ? capitalizeWords(user.name) : 'TripSplitter'}
          </Text>
          <Text style={[type.small, { marginTop: 2, textAlign: 'center' }]}>{user?.email}</Text>
          <View style={{ marginTop: space.md, flexDirection: 'row', gap: space.xs }}>
            <Chip label="Verified Account" tone="good" icon="shield-checkmark-outline" />
          </View>
        </View>

        <View style={{ marginTop: space.lg, borderTopWidth: 1, borderTopColor: colors.lineLight, paddingTop: space.md }}>
          <Button
            title="Edit Profile Name"
            variant="secondary"
            small
            icon="create-outline"
            onPress={() => setEditNameOpen(true)}
          />
        </View>
      </Card>

      {/* Stats Section */}
      <Text style={[type.caption, { marginHorizontal: space.xs, marginBottom: space.xs }]}>FINANCIAL SUMMARY</Text>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={type.small}>Total Spent</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 4 }}>
            {formatPaise(totalSpent, 'INR')}
          </Text>
          <Text style={[type.small, { fontSize: 11.5, marginTop: 2 }]}>Across all {trips.length} trips</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={type.small}>Active Trips</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 4 }}>
            {activeTrips} <Text style={{ fontSize: 14, fontWeight: '500', color: colors.muted }}>/ {trips.length}</Text>
          </Text>
          <Text style={[type.small, { fontSize: 11.5, marginTop: 2 }]}>{trips.length - activeTrips} settled</Text>
        </Card>
      </View>

      {/* Quick Navigation Links */}
      <Text style={[type.caption, { marginHorizontal: space.xs, marginTop: space.md, marginBottom: space.xs }]}>
        NAVIGATION & SHORTCUTS
      </Text>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => navigation.navigate('Trips')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="airplane-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.subheading}>See All Trips</Text>
            <Text style={type.small}>{trips.length} total trips in your account</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => navigation.navigate('Notifications')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.warnSoft }]}>
            <Ionicons name="notifications-outline" size={20} color={colors.warn} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.subheading}>Notifications</Text>
            <Text style={type.small}>{unreadNotes > 0 ? `${unreadNotes} unread updates` : 'All caught up'}</Text>
          </View>
          {unreadNotes > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadNotes}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          )}
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => navigation.navigate('Join')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="key-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.subheading}>Join with 6-Digit Code</Text>
            <Text style={type.small}>Enter an invite code from a friend</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </Card>
      </ScrollView>

      {/* ── Log Out — pinned to very bottom of screen ───────────────── */}
      <View style={styles.logoutBar}>
        <View style={styles.divider} />
        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => setLogoutOpen(true)}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.subheading, { color: colors.danger }]}>Log Out</Text>
            <Text style={type.small}>Sign out of this device</Text>
          </View>
        </Pressable>
      </View>

      {/* Edit Name Modal */}
      <PromptModal
        visible={editNameOpen}
        title="Edit Display Name"
        initial={user?.name ?? ''}
        placeholder="Your Full Name"
        autoCapitalize="words"
        confirmLabel="Save Changes"
        onCancel={() => setEditNameOpen(false)}
        onConfirm={(name) => {
          setEditNameOpen(false);
          handleSaveName(name);
        }}
      />

      {/* Logout Confirmation */}
      <ConfirmModal
        visible={logoutOpen}
        title="Log Out"
        message="Are you sure you want to log out of TripSplit on this device?"
        confirmLabel="Log Out"
        confirmVariant="danger"
        loading={busy}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space.lg,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.goodSoft,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  profileCard: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xs,
  },
  statCard: {
    flex: 1,
    padding: space.md,
    marginBottom: 0,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 14,
    gap: space.md,
  },
  pressedItem: {
    backgroundColor: colors.lineLight,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lineLight,
    marginLeft: 58,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
  },
});

