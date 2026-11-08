import React, { useLayoutEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const trips = tripsQuery.data ?? [];
  const totalSpent = trips.reduce((sum, t) => sum + (t.totalSpentPaise || 0), 0);
  const activeTrips = trips.filter((t) => t.status === 'ACTIVE').length;
  const unreadNotes = notesQuery.data?.unread ?? 0;

  // Header Right: Delete Account Button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setDeleteAccountOpen(true)}
          hitSlop={10}
          accessibilityLabel="Delete Account"
          style={styles.deleteHeaderBtn}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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

  const handleDeleteAccount = async () => {
    if (confirmDeleteText.trim().toLowerCase() !== 'confirm') return;
    setBusy(true);
    try {
      setDeleteAccountOpen(false);
      setConfirmDeleteText('');
      Alert.alert(
        'Account Deleted',
        'Your account has been scheduled for permanent deletion and you have been signed out.',
        [{ text: 'OK', onPress: () => logout() }]
      );
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {feedback ? (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.good} />
          <Text style={{ color: colors.good, fontWeight: '600', fontSize: 13.5 }}>{feedback}</Text>
        </View>
      ) : null}

      {/* Page Title in matching theme */}
      <View style={{ marginBottom: space.md, paddingHorizontal: space.xs }}>
        <Text style={type.caption}>PROFILE & IDENTITY</Text>
        <Text style={[type.largeTitle, { fontSize: 26, marginTop: 2 }]}>Account Overview</Text>
      </View>

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

      {/* Velto-style Virtual Credit Card UI */}
      <Text style={[type.caption, { marginHorizontal: space.xs, marginBottom: space.xs }]}>
        MEMBER FINANCIAL CARD
      </Text>
      <View style={styles.creditCard}>
        {/* Card Top: Chip + Contactless + Brand */}
        <View style={styles.cardTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.chipGraphic}>
              <View style={styles.chipInnerGrid} />
            </View>
            <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.7)" style={{ transform: [{ rotate: '90deg' }] }} />
          </View>
          <View style={styles.cardBrandBadge}>
            <View style={styles.voltDot} />
            <Text style={styles.cardBrandText}>TRIPSPLIT PASS</Text>
          </View>
        </View>

        {/* Card Center: Big Balance */}
        <View style={{ marginTop: 22, marginBottom: 18 }}>
          <Text style={styles.cardBalanceLabel}>TOTAL CUMULATIVE SPEND</Text>
          <Text style={styles.cardBalanceAmount}>{formatPaise(totalSpent, 'INR')}</Text>
        </View>

        {/* Card Bottom: Holder, Email, Expiry */}
        <View style={styles.cardBottomRow}>
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
            <Text style={styles.cardHolderName} numberOfLines={1}>
              {(user?.name || 'MEMBER').toUpperCase()}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', flex: 1.2 }}>
            <Text style={styles.cardNumberMasked} numberOfLines={1}>
              {user?.email ? user.email.toLowerCase() : '•••• ••••'}
            </Text>
            <Text style={styles.cardExpiryText}>{trips.length} TRIPS LINKED</Text>
          </View>
        </View>
      </View>

      {/* Card Stats Pills */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <View style={styles.metricPill}>
          <Text style={styles.metricPillLabel}>Active Trips</Text>
          <Text style={styles.metricPillValue}>{activeTrips}</Text>
        </View>
        <View style={styles.metricPill}>
          <Text style={styles.metricPillLabel}>Settled Trips</Text>
          <Text style={styles.metricPillValue}>{trips.length - activeTrips}</Text>
        </View>
        <View style={[styles.metricPill, { backgroundColor: colors.voltSoft, borderColor: 'rgba(212,255,0,0.4)' }]}>
          <Text style={[styles.metricPillLabel, { color: colors.voltText }]}>Status</Text>
          <Text style={[styles.metricPillValue, { color: colors.primaryDark }]}>Active</Text>
        </View>
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

        {/* Spending Analytics (Upcoming) */}
        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => setAnalyticsModalOpen(true)}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="pie-chart-outline" size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={type.subheading}>Spending Analytics</Text>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
              </View>
            </View>
            <Text style={type.small}>Category charts, spending trends & exportable summaries</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>

        <View style={styles.divider} />

        {/* How TripSplit Works & Guidelines */}
        <Pressable
          style={({ pressed }) => [styles.navItem, pressed && styles.pressedItem]}
          onPress={() => setGuideOpen(true)}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.subheading}>How TripSplit Works</Text>
            <Text style={type.small}>Use cases, calculation rules & guidelines</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
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

        <View style={styles.divider} />

        {/* Log Out Button directly below Join with 6-digit code */}
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
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
      </Card>

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

      {/* How TripSplit Works & Guidelines Modal */}
      <Modal
        visible={guideOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGuideOpen(false)}
      >
        <View style={styles.guideContainer}>
          {/* Header */}
          <View style={styles.guideHeader}>
            <View>
              <Text style={type.title}>How TripSplit Works</Text>
              <Text style={[type.small, { marginTop: 2 }]}>Use cases, calculation rules & guidelines</Text>
            </View>
            <Pressable onPress={() => setGuideOpen(false)} hitSlop={12} style={styles.guideCloseBtn}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.guideContent} showsVerticalScrollIndicator={false}>
            {/* Section 1: Use cases */}
            <Card style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={[styles.iconCircleSmall, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="compass-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[type.subheading, { color: colors.ink }]}>1. What It's Used For</Text>
              </View>
              <Text style={styles.guideParagraph}>
                TripSplit makes sharing expenses painless without spreadsheets or awkward money conversations:
              </Text>
              <View style={styles.bulletRow}>
                <Ionicons name="airplane-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Trips & Vacations: </Text>Hotels, flights, car rentals, group dinners, and entry tickets.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="home-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Roommates & Flats: </Text>Monthly rent, Wi-Fi, electricity, domestic supplies, and groceries.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="wine-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Dinners & Group Outings: </Text>Evenly splitting café and restaurant bills among friends.
                </Text>
              </View>
            </Card>

            {/* Section 2: Calculation Engine */}
            <Card style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={[styles.iconCircleSmall, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="calculator-outline" size={18} color={colors.accent} />
                </View>
                <Text style={[type.subheading, { color: colors.ink }]}>2. How We Calculate Money</Text>
              </View>
              <Text style={styles.guideParagraph}>
                Our calculation engine is built on mathematical invariants designed for financial precision:
              </Text>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Zero Float Errors: </Text>All amounts are tracked internally in whole paise (1/100th unit). You will never see decimal rounding errors.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Remainder Allocation: </Text>When an amount cannot be divided evenly (e.g., ₹100 among 3 people), the 1 extra paisa is deterministically distributed so the shares always equal the bill exactly.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="git-merge-outline" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700' }}>Smart Debt Simplification: </Text>Instead of dozens of criss-cross transfers, our greedy optimizer matches the biggest debtors with the biggest creditors. A group of 10 people settles in at most 9 transfers!
                </Text>
              </View>
            </Card>

            {/* Section 3: How to Use */}
            <Card style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={[styles.iconCircleSmall, { backgroundColor: colors.goodSoft }]}>
                  <Ionicons name="list-outline" size={18} color={colors.good} />
                </View>
                <Text style={[type.subheading, { color: colors.ink }]}>3. How to Use</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={styles.stepText}><Text style={{ fontWeight: '700' }}>Create a Trip: </Text>Give it a name and select your currency.</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepText}><Text style={{ fontWeight: '700' }}>Invite Friends: </Text>Share your 6-digit code or link. You can also add guest names if friends don't have the app yet.</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepText}><Text style={{ fontWeight: '700' }}>Add Expenses: </Text>Tap the + button, enter the bill, select who paid, and select who splits it.</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                <Text style={styles.stepText}><Text style={{ fontWeight: '700' }}>Check Balances: </Text>See live who owes whom in the Balances tab.</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>5</Text></View>
                <Text style={styles.stepText}><Text style={{ fontWeight: '700' }}>Settle Up: </Text>Record repayments in the app once money is sent via UPI or cash.</Text>
              </View>
            </Card>

            {/* Section 4: Rules & Limitations */}
            <Card style={styles.guideCard}>
              <View style={styles.guideCardHeader}>
                <View style={[styles.iconCircleSmall, { backgroundColor: colors.warnSoft }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warn} />
                </View>
                <Text style={[type.subheading, { color: colors.ink }]}>4. Current Rules & Scope</Text>
              </View>
              <Text style={styles.guideParagraph}>
                To keep calculations reliable and unambiguous:
              </Text>
              <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '700' }}>One Payer Per Expense: </Text>Each expense has a single payer. For shared bill payments, enter two separate expenses.</Text>
              <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '700' }}>Equal Split: </Text>Expenses are divided equally among selected participants.</Text>
              <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '700' }}>Single Currency: </Text>Each trip operates in one primary currency (default INR).</Text>
              <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '700' }}>Owner Authority: </Text>The trip owner approves join requests and marks the trip settled when done.</Text>
            </Card>

            <View style={{ marginTop: space.sm, marginBottom: space.xl }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#D4FF00',
                  height: 50,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...shadows.md,
                }}
                onPress={() => setGuideOpen(false)}
                activeOpacity={0.88}
              >
                <Text style={{ color: '#08251C', fontSize: 16, fontWeight: '800' }}>
                  Got It
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Spending Analytics (Coming Soon) Modal */}
      <Modal
        visible={analyticsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAnalyticsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.promptModalCard}>
            <View style={[styles.modalIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="pie-chart-outline" size={26} color="#16A34A" />
            </View>
            <Text style={[type.title, { textAlign: 'center', marginTop: space.sm }]}>
              Spending Analytics
            </Text>
            <Text style={[type.body, { textAlign: 'center', color: colors.muted, marginTop: space.xs, fontSize: 13.5, lineHeight: 19 }]}>
              We are working on intelligent multi-trip spending breakdowns, category distribution graphs, and debt velocity timelines.
            </Text>
            <View style={{ marginTop: space.md, alignItems: 'center' }}>
              <View style={styles.comingSoonBadgeLarge}>
                <Text style={styles.comingSoonBadgeLargeText}>COMING SOON IN V2.1</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.primary, marginTop: space.lg, width: '100%', alignItems: 'center' }]}
              onPress={() => setAnalyticsModalOpen(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteAccountOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDeleteAccountOpen(false);
          setConfirmDeleteText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.promptModalCard}>
            <View style={[styles.modalIconCircle, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="trash-outline" size={26} color={colors.danger} />
            </View>
            <Text style={[type.title, { textAlign: 'center', marginTop: space.sm, color: colors.danger }]}>
              Delete Account
            </Text>
            <Text style={[type.body, { textAlign: 'center', color: colors.muted, marginTop: space.xs, fontSize: 13.5, lineHeight: 19 }]}>
              This action is permanent and cannot be undone. All your trips, settlements, and account data will be permanently removed.
            </Text>
            <Text style={[type.small, { textAlign: 'center', fontWeight: '700', color: colors.ink, marginTop: space.md }]}>
              Type "confirm" below to delete your account:
            </Text>

            <TextInput
              style={styles.deleteInput}
              placeholder='Type "confirm"'
              placeholderTextColor={colors.subtle}
              value={confirmDeleteText}
              onChangeText={setConfirmDeleteText}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setDeleteAccountOpen(false);
                  setConfirmDeleteText('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalDeleteBtn,
                  confirmDeleteText.trim().toLowerCase() !== 'confirm' && styles.modalDeleteBtnDisabled,
                ]}
                disabled={confirmDeleteText.trim().toLowerCase() !== 'confirm' || busy}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.modalDeleteText}>
                  {busy ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space.lg,
    paddingBottom: 48,
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
  creditCard: {
    backgroundColor: '#0C1C15',
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGraphic: {
    width: 34,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#D1A354',
    borderWidth: 1,
    borderColor: '#F7D488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInnerGrid: {
    width: 20,
    height: 12,
    borderWidth: 1,
    borderColor: '#9E742A',
    borderRadius: 2,
  },
  cardBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 255, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.3)',
  },
  voltDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4FF00',
  },
  cardBrandText: {
    color: '#D4FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardBalanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardBalanceAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  cardHolderLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardHolderName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardNumberMasked: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardExpiryText: {
    color: '#D4FF00',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  metricPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  metricPillLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricPillValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
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
  guideContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineLight,
    backgroundColor: colors.card,
  },
  guideCloseBtn: {
    padding: space.xs,
    borderRadius: radius.full,
    backgroundColor: colors.lineLight,
  },
  guideContent: {
    padding: space.lg,
    paddingBottom: 40,
    gap: space.md,
  },
  guideCard: {
    padding: space.md,
    marginBottom: 0,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  iconCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideParagraph: {
    fontSize: 13.5,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: space.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.goodSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.good,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  ruleItem: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
    marginBottom: 6,
  },

  // Delete Account Header Button
  deleteHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },

  // Coming Soon Badges
  comingSoonBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.4)',
  },
  comingSoonBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  comingSoonBadgeLarge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  comingSoonBadgeLargeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },

  // Modals (Analytics & Delete Account)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 24, 18, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.lg,
  },
  promptModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  modalIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteInput: {
    width: '100%',
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    marginTop: space.md,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: space.sm,
    width: '100%',
    marginTop: space.lg,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: colors.lineLight,
  },
  modalCancelText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteBtn: {
    backgroundColor: colors.danger,
  },
  modalDeleteBtnDisabled: {
    opacity: 0.45,
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

