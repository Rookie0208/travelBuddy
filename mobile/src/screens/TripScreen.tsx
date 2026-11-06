import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { colors, radius, space, type } from '../theme';
import type { Props } from '../navigation/types';
import ExpensesTab from './trip/ExpensesTab';
import BalancesTab from './trip/BalancesTab';
import HistoryTab from './trip/HistoryTab';
import MembersTab from './trip/MembersTab';

type TabKey = 'expenses' | 'balances' | 'history' | 'members';

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
      title: data?.name ?? '',
      headerRight: () =>
        data ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {/* Add person (owner only) */}
            {isOwner ? (
              <Pressable
                onPress={() => setAddPersonVisible(true)}
                accessibilityLabel="Add person by name"
                hitSlop={10}
              >
                <Ionicons name="person-add-outline" size={22} color={colors.ink} />
              </Pressable>
            ) : null}
            {/* Single file button → opens sheet with download + upload */}
            <Pressable
              onPress={() => setFileSheetOpen(true)}
              accessibilityLabel="File actions"
              hitSlop={10}
            >
              <Ionicons name="document-outline" size={24} color={colors.ink} />
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
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'expenses', label: 'Expenses' },
    { key: 'balances', label: 'Balances' },
    { key: 'history', label: 'History' },
    { key: 'members', label: 'People', badge: pending },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: space.lg,
          marginBottom: space.sm,
          backgroundColor: '#E9E4D8',
          borderRadius: 12,
          padding: 3,
        }}
      >
        {tabs.map(t => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 10,
                alignItems: 'center',
                backgroundColor: on ? '#fff' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: on ? '700' : '500',
                  color: on ? colors.primaryDark : colors.muted,
                }}
              >
                {t.label}{t.badge ? `  (${t.badge})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        {tab === 'expenses' && <ExpensesTab trip={data} navigation={navigation} />}
        {tab === 'balances' && <BalancesTab trip={data} />}
        {tab === 'history' && <HistoryTab trip={data} />}
        {tab === 'members' && <MembersTab trip={data} navigation={navigation} />}
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
