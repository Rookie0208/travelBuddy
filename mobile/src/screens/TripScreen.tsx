import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { api, errorMessage, errorStatus, tokenStore } from '../api/client';
import { API_URL } from '../config';
import { capitalizeWords } from '../utils/format';
import { ConfirmModal, ErrorState, Loading, PromptModal } from '../components/ui';
import { invalidateTrip } from '../queries';
import { colors, radius, shadows, space, type } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Props } from '../navigation/types';
import ExpensesTab from './trip/ExpensesTab';
import BalancesTab from './trip/BalancesTab';
import HistoryTab from './trip/HistoryTab';
import MembersTab from './trip/MembersTab';

type TabKey = 'expenses' | 'balances' | 'members' | 'history';

// ─── File action sheet modal ─────────────────────────────────────────────────
function FileActionsSheet({
  visible,
  onClose,
  onDownload,
  onUpload,
  downloading,
  uploading,
}: {
  visible: boolean;
  onClose: () => void;
  onDownload: () => void;
  onUpload: () => void;
  downloading: boolean;
  uploading: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Invisible tap-away area — no dim overlay */}
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: space.lg,
          paddingBottom: 36,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
          <View
            style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: colors.line, alignSelf: 'center', marginBottom: space.lg,
            }}
          />
          <Text style={[type.heading, { marginBottom: space.lg }]}>Excel / Spreadsheet</Text>

          {/* Download */}
          <TouchableOpacity
            onPress={() => { onClose(); onDownload(); }}
            disabled={downloading}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space.md,
              padding: space.md, borderRadius: radius.md, marginBottom: space.sm,
              backgroundColor: colors.primarySoft,
            }}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: radius.md,
                backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
              }}
            >
              {downloading
                ? <Animated.View><Ionicons name="hourglass-outline" size={22} color="#fff" /></Animated.View>
                : <Ionicons name="download-outline" size={22} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.subheading}>Download Excel</Text>
              <Text style={type.small}>Export full ledger as .xlsx</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </TouchableOpacity>

          {/* Upload */}
          <TouchableOpacity
            onPress={() => { onClose(); onUpload(); }}
            disabled={uploading}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space.md,
              padding: space.md, borderRadius: radius.md,
              backgroundColor: colors.accentSoft,
            }}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: radius.md,
                backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
              }}
            >
              {uploading
                ? <Ionicons name="hourglass-outline" size={22} color="#fff" />
                : <Ionicons name="cloud-upload-outline" size={22} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.subheading}>Upload Excel</Text>
              <Text style={type.small}>Import expenses from .xlsx file</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function TripScreen({ route, navigation }: Props<'Trip'>) {
  const insets = useSafeAreaInsets();
  const { tripId } = route.params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('expenses');
  const [fileSheetOpen, setFileSheetOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addPersonVisible, setAddPersonVisible] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const trip = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => endpoints.trips.get(tripId),
  });
  const data = trip.data;
  const isOwner = data?.myRole === 'OWNER';

  // ── Download Excel ──────────────────────────────────────────────────────────
  const downloadExcel = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await api.get('/me'); // refresh token
      const token = await tokenStore.getAccess();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = `${API_URL}/api/v1/trips/${tripId}/export.xlsx`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
        const blob = await resp.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${data.name.replace(/[^A-Za-z0-9_-]+/g, '_')}_ledger.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        return;
      }
      const safe = data.name.replace(/[^A-Za-z0-9_-]+/g, '_');
      const target = `${FileSystem.cacheDirectory}${safe}_ledger.xlsx`;
      const res = await FileSystem.downloadAsync(
        `${API_URL}/api/v1/trips/${tripId}/export.xlsx`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Trip ledger',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
        });
      } else {
        setConfirmModal({
          visible: true, title: 'Saved',
          message: 'File saved but sharing is not available on this device.',
          confirmLabel: 'OK', onConfirm: () => {},
        });
      }
    } catch (e) {
      setConfirmModal({
        visible: true, title: 'Could not download',
        message: e instanceof Error && e.message.startsWith('Download') ? e.message : errorMessage(e),
        confirmLabel: 'OK', onConfirm: () => {},
      });
    } finally {
      setDownloading(false);
    }
  };

  // ── Upload Excel ────────────────────────────────────────────────────────────
  const uploadExcel = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web: use hidden <input type="file">
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
          await endpoints.trips.uploadExcel(tripId, {
            uri: URL.createObjectURL(file),
            name: file.name,
            mimeType: file.type,
          });
          invalidateTrip(qc, tripId);
          setConfirmModal({
            visible: true,
            title: 'Import successful',
            message: 'Expenses from the Excel file have been imported.',
            confirmLabel: 'Great!',
            onConfirm: () => {},
          });
        } catch (e) {
          setConfirmModal({
            visible: true, title: 'Upload failed',
            message: errorMessage(e), confirmLabel: 'OK', onConfirm: () => {},
          });
        } finally {
          setUploading(false);
        }
      };
      input.click();
      return;
    }
    // Native: Excel upload requires the web version
    setConfirmModal({
      visible: true,
      title: 'Upload not available',
      message: 'Excel upload is only supported on the web version of the app. Please open TripSplit in a browser to import expenses.',
      confirmLabel: 'OK',
      onConfirm: () => {},
    });
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitle: () => null,
      headerRight: () =>
        data ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginRight: Platform.OS === 'ios' ? space.sm : space.md,
              paddingRight: Platform.OS === 'web' ? 6 : 0,
            }}
          >
            {/* Add person (owner only) */}
            {isOwner ? (
              <Pressable
                onPress={() => setAddPersonVisible(true)}
                accessibilityLabel="Add person by name"
                hitSlop={10}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.lineLight,
                  ...shadows.sm,
                }}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.ink} />
              </Pressable>
            ) : null}

            {/* Analytics button */}
            <Pressable
              onPress={() => navigation.navigate('TripAnalytics', { tripId: data.id })}
              accessibilityLabel="Trip Analytics"
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.lineLight,
                ...shadows.sm,
              }}
            >
              <Ionicons name="stats-chart-outline" size={17} color={colors.primary} />
            </Pressable>

            {/* Excel button (icon only) with proper right spacing */}
            <Pressable
              onPress={() => setFileSheetOpen(true)}
              accessibilityLabel="Excel Export and Import"
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#0A1813',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: '#1D3B2E',
                ...shadows.sm,
              }}
            >
              <Ionicons name="document-text" size={18} color="#D4FF00" />
            </Pressable>
          </View>
        ) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, data, isOwner]);

  if (trip.isLoading) return <Loading />;
  if (trip.isError || !data) {
    const gone = errorStatus(trip.error) === 404;
    return gone ? (
      <ErrorState
        message="This trip is not available. You may have been removed, or it was deleted."
        onRetry={() => navigation.popToTop()}
      />
    ) : (
      <ErrorState message={errorMessage(trip.error)} onRetry={() => trip.refetch()} />
    );
  }

  const pending = data.joinRequests.length;
  const tabs: {
    key: TabKey;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    activeIcon: React.ComponentProps<typeof Ionicons>['name'];
    badge?: number;
  }[] = [
    { key: 'expenses', icon: 'receipt-outline', activeIcon: 'receipt' },
    { key: 'balances', icon: 'scale-outline', activeIcon: 'scale' },
    { key: 'members', icon: 'people-outline', activeIcon: 'people', badge: pending },
    { key: 'history', icon: 'time-outline', activeIcon: 'time' },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Trip Header: Consistent with all other sections (No odd white card) ── */}
      <View style={styles.tripHeaderSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>TRIP OVERVIEW</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={styles.tripTitleText} numberOfLines={1}>
                {data.name}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: data.status === 'ACTIVE' ? '#10B981' : colors.muted },
                ]}
              />
            </View>

            {/* Just below the trip name: Invite code & Destination */}
            <View style={styles.tripMetaRow}>
              {data.inviteCode ? (
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(data.inviteCode!);
                      alert(`Invite code ${data.inviteCode} copied to clipboard!`);
                    } else {
                      Alert.alert('Trip Invite Code', `Share this code with your friends:\n\n${data.inviteCode}`);
                    }
                  }}
                  activeOpacity={0.75}
                  style={styles.invitePill}
                >
                  <Ionicons name="key-outline" size={13} color={colors.primaryDark} />
                  <Text style={styles.invitePillLabel}>Invite Code:</Text>
                  <Text style={styles.invitePillCode}>{data.inviteCode}</Text>
                  <Ionicons name="copy-outline" size={11} color={colors.primaryDark} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              ) : null}

              {data.destination ? (
                <Text style={styles.destText} numberOfLines={1}>
                  {data.destination}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 12) + 74 }}>
        {tab === 'expenses' && <ExpensesTab trip={data} navigation={navigation} />}
        {tab === 'balances' && <BalancesTab trip={data} />}
        {tab === 'members' && <MembersTab trip={data} navigation={navigation} />}
        {tab === 'history' && <HistoryTab trip={data} />}
      </View>

      {/* ── Velto Floating Dock Bottom Navigation Bar ──────────────── */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom, 12) + 12,
          left: space.md,
          right: space.md,
          backgroundColor: '#0A1813',
          borderRadius: radius.full,
          height: 60,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 6,
          borderWidth: 1.5,
          borderColor: '#1D3B2E',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        {/* Tab 1: Expenses */}
        <Pressable
          onPress={() => setTab('expenses')}
          style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          hitSlop={8}
        >
          <View
            style={{
              minWidth: 46,
              height: 38,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tab === 'expenses' ? '#D4FF00' : 'transparent',
              paddingHorizontal: 8,
            }}
          >
            <Ionicons
              name={tab === 'expenses' ? 'receipt' : 'receipt-outline'}
              size={21}
              color={tab === 'expenses' ? '#08251C' : 'rgba(255,255,255,0.6)'}
            />
          </View>
        </Pressable>

        {/* Tab 2: Balances */}
        <Pressable
          onPress={() => setTab('balances')}
          style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          hitSlop={8}
        >
          <View
            style={{
              minWidth: 46,
              height: 38,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tab === 'balances' ? '#D4FF00' : 'transparent',
              paddingHorizontal: 8,
            }}
          >
            <Ionicons
              name={tab === 'balances' ? 'scale' : 'scale-outline'}
              size={21}
              color={tab === 'balances' ? '#08251C' : 'rgba(255,255,255,0.6)'}
            />
          </View>
        </Pressable>

        {/* Center: Popped-Out Add Expense Button */}
        <TouchableOpacity
          onPress={() => {
            if (data.status !== 'SETTLED') {
              navigation.navigate('ExpenseForm', { tripId: data.id });
            }
          }}
          activeOpacity={0.85}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: '#D4FF00',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -20,
            borderWidth: 3.5,
            borderColor: '#0A1813',
            shadowColor: '#D4FF00',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 14,
          }}
        >
          <Ionicons name="add" size={30} color="#08251C" />
        </TouchableOpacity>

        {/* Tab 3: Members */}
        <Pressable
          onPress={() => setTab('members')}
          style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          hitSlop={8}
        >
          <View
            style={{
              minWidth: 46,
              height: 38,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tab === 'members' ? '#D4FF00' : 'transparent',
              paddingHorizontal: 8,
            }}
          >
            <Ionicons
              name={tab === 'members' ? 'people' : 'people-outline'}
              size={21}
              color={tab === 'members' ? '#08251C' : 'rgba(255,255,255,0.6)'}
            />
            {pending > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  backgroundColor: colors.danger,
                  borderRadius: 7,
                  minWidth: 14,
                  height: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                  {pending > 9 ? '9+' : pending}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Tab 4: History */}
        <Pressable
          onPress={() => setTab('history')}
          style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          hitSlop={8}
        >
          <View
            style={{
              minWidth: 46,
              height: 38,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tab === 'history' ? '#D4FF00' : 'transparent',
              paddingHorizontal: 8,
            }}
          >
            <Ionicons
              name={tab === 'history' ? 'time' : 'time-outline'}
              size={21}
              color={tab === 'history' ? '#08251C' : 'rgba(255,255,255,0.6)'}
            />
          </View>
        </Pressable>
      </View>

      {/* ── File actions sheet ───────────────────────────────────── */}
      <FileActionsSheet
        visible={fileSheetOpen}
        onClose={() => setFileSheetOpen(false)}
        onDownload={downloadExcel}
        onUpload={uploadExcel}
        downloading={downloading}
        uploading={uploading}
      />

      {/* ── Add person modal ─────────────────────────────────────── */}
      <PromptModal
        visible={addPersonVisible}
        title="Add a person by name"
        placeholder="Friend's name"
        confirmLabel="Add"
        autoCapitalize="words"
        onCancel={() => setAddPersonVisible(false)}
        onConfirm={async text => {
          setAddPersonVisible(false);
          try {
            await endpoints.trips.addGuest(tripId, capitalizeWords(text));
            invalidateTrip(qc, tripId);
          } catch (e) {
            setConfirmModal({
              visible: true, title: 'Could not add person',
              message: errorMessage(e), confirmLabel: 'OK', onConfirm: () => {},
            });
          }
        }}
      />

      {/* ── Generic confirm / info modal ─────────────────────────── */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onCancel={() => setConfirmModal(c => ({ ...c, visible: false }))}
        onConfirm={() => {
          const fn = confirmModal.onConfirm;
          setConfirmModal(c => ({ ...c, visible: false }));
          fn();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tripHeaderSection: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  tripTitleText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(13, 56, 42, 0.15)',
  },
  invitePillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  invitePillCode: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
  destText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
});
