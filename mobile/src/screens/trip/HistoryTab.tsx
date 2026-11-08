import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Activity, TripDetail } from '../../api/types';
import { Avatar, Button, EmptyState, ErrorState, Loading } from '../../components/ui';
import { colors, radius, shadows, space, type } from '../../theme';
import { formatWhen } from '../../utils/format';

export function ActivityRow({ a }: { a: Activity }) {
  const isQuery = a.type === 'QUERY';
  const isComment = a.type === 'COMMENT';
  const isSettlement = a.type === 'SETTLEMENT_RECORDED';
  const isMember =
    a.type === 'MEMBER_JOINED' ||
    a.type === 'MEMBER_ADDED' ||
    a.type === 'MEMBER_RENAMED' ||
    a.type === 'MEMBER_REMOVED' ||
    a.type === 'MEMBER_LEFT' ||
    a.type === 'MEMBER_UNLINKED';
  const isExpense = a.type === 'EXPENSE_ADDED' || a.type === 'EXPENSE_EDITED';

  const badgeIcon: React.ComponentProps<typeof Ionicons>['name'] = isQuery
    ? 'help-circle'
    : isComment
    ? 'chatbubble-ellipses'
    : isSettlement
    ? 'swap-horizontal'
    : isMember
    ? 'person-add'
    : isExpense
    ? 'receipt'
    : 'information-circle';

  const badgeColor = isQuery
    ? colors.warn
    : isComment
    ? colors.accent
    : isSettlement
    ? colors.good
    : isMember
    ? '#0284C7'
    : isExpense
    ? colors.primary
    : colors.muted;

  const badgeBg = isQuery
    ? colors.warnSoft
    : isComment
    ? colors.accentSoft
    : isSettlement
    ? colors.goodSoft
    : isMember
    ? '#E0F2FE'
    : isExpense
    ? colors.primarySoft
    : colors.lineLight;

  return (
    <View
      style={[
        styles.activityCard,
        isQuery && styles.queryCard,
        isComment && styles.commentCard,
        isMember && { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
      ]}
    >
      <View style={styles.activityHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
          <Avatar name={a.actorName || 'Member'} size={34} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.actorName} numberOfLines={1}>
                {a.actorName}
              </Text>
              <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                <Ionicons name={badgeIcon} size={11} color={badgeColor} />
                <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
                  {isQuery
                    ? 'QUERY'
                    : isComment
                    ? 'COMMENT'
                    : isSettlement
                    ? 'SETTLED'
                    : isMember
                    ? 'NEW MEMBER'
                    : 'EXPENSE'}
                </Text>
              </View>
            </View>
            <Text style={styles.timeText}>{formatWhen(a.createdAt)}</Text>
          </View>
        </View>
      </View>

      <Text
        style={[
          styles.activityMessage,
          isQuery && { fontWeight: '600', color: '#78350F' },
          isMember && { color: '#0369A1', fontWeight: '500' },
        ]}
      >
        {a.message}
      </Text>
    </View>
  );
}

/** Modern comment box with toggle between Comment and Group Query */
export function CommentBox({ tripId, expenseId }: { tripId: string; expenseId?: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [asQuery, setAsQuery] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await endpoints.ledger.comment(tripId, text.trim(), asQuery, expenseId);
      setText('');
      setAsQuery(false);
      qc.invalidateQueries({ queryKey: ['activities', tripId] });
    } catch (e) {
      Alert.alert('Could not send', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.commentBoxContainer}>
      {/* Mode Selector Pills */}
      <View style={styles.commentModeRow}>
        <Pressable
          style={[styles.modePill, !asQuery && styles.modePillActive]}
          onPress={() => setAsQuery(false)}
        >
          <Ionicons name="chatbubble-outline" size={13} color={!asQuery ? colors.primary : colors.muted} />
          <Text style={[styles.modePillText, !asQuery && styles.modePillTextActive]}>Comment</Text>
        </Pressable>

        <Pressable
          style={[styles.modePill, asQuery && styles.modePillQueryActive]}
          onPress={() => setAsQuery(true)}
        >
          <Ionicons name="help-circle-outline" size={13} color={asQuery ? colors.warn : colors.muted} />
          <Text style={[styles.modePillText, asQuery && { color: colors.warn, fontWeight: '700' }]}>
            Raise Query
          </Text>
        </Pressable>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={asQuery ? 'Ask the group a question or raise a doubt…' : 'Write a comment for this trip…'}
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={1000}
          style={[styles.textInput, asQuery && { borderColor: '#FCD34D' }]}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!text.trim() || busy}
          style={[
            styles.sendButton,
            { backgroundColor: text.trim() ? (asQuery ? colors.warn : colors.primary) : colors.line },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HistoryTab({ trip }: { trip: TripDetail }) {
  const q = useQuery({
    queryKey: ['activities', trip.id],
    queryFn: () => endpoints.ledger.activities(trip.id),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) {
    return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={120}
    >
      <FlatList
        data={q.data.items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No activity yet"
            hint="Every expense, settlement, and comment shows up here in chronological order."
          />
        }
        renderItem={({ item }) => <ActivityRow a={item} />}
      />
      <CommentBox tripId={trip.id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: space.lg,
    paddingBottom: 20,
    flexGrow: 1,
    gap: space.sm,
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  queryCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  commentCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  actorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  timeText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activityMessage: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    marginTop: space.xs,
  },
  commentBoxContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.lineLight,
    padding: space.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : space.md,
    ...shadows.md,
  },
  commentModeRow: {
    flexDirection: 'row',
    gap: space.xs,
    marginBottom: space.sm,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.lineLight,
  },
  modePillActive: {
    backgroundColor: colors.primarySoft,
  },
  modePillQueryActive: {
    backgroundColor: colors.warnSoft,
  },
  modePillText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  modePillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    fontSize: 14.5,
    color: colors.ink,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});
