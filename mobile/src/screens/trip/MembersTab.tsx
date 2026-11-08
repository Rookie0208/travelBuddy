import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { getShareUrl } from '../../config';
import type { Member, TripDetail } from '../../api/types';
import {
  ActionMenuModal,
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmModal,
  PromptModal,
  SectionTitle,
} from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { invalidateTrip } from '../../queries';
import { colors, space, type } from '../../theme';
import { capitalizeWords } from '../../utils/format';

export default function MembersTab({
  trip,
  navigation,
}: {
  trip: TripDetail;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Trip'>;
}) {
  const qc = useQueryClient();
  const owner = trip.myRole === 'OWNER';

  const [prompt, setPrompt] = useState<
    null | { kind: 'add' } | { kind: 'rename'; member: Member }
  >(null);
  const [refreshing, setRefreshing] = useState(false);

  // ActionMenuModal state (replaces Alert.alert button arrays)
  const [actionMenu, setActionMenu] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    options: {
      label: string;
      icon?: React.ComponentProps<typeof ActionMenuModal>['options'][0]['icon'];
      destructive?: boolean;
      onPress: () => void;
    }[];
  }>({ visible: false, title: '', options: [] });

  // ConfirmModal state (replaces Alert.alert with 2 buttons)
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger';
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const [copyFeedback, setCopyFeedback] = useState(false);
  const [addedFriends, setAddedFriends] = useState<Set<string>>(new Set());
  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  const people = trip.members.filter((m) => !m.left);

  const run = async (fn: () => Promise<unknown>, errTitle = 'Could not do that') => {
    try {
      await fn();
      invalidateTrip(qc, trip.id);
    } catch (e) {
      setConfirmModal({
        visible: true,
        title: errTitle,
        message: errorMessage(e),
        confirmLabel: 'OK',
        onConfirm: () => {},
      });
    }
  };

  const shareInvite = async () => {
    if (!trip.inviteCode) return;
    const code = trip.inviteCode.toUpperCase();
    const url = getShareUrl(code);
    await Share.share({
      message: `Join "${trip.name}" on TripSplit.\n\nLink: ${url}\n\nCode: ${code}\n\nThe owner must approve your request.`,
      url,
    });
  };

  const copyCode = async () => {
    if (!trip.inviteCode) return;
    await Clipboard.setStringAsync(trip.inviteCode.toUpperCase());
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const addFriend = async (m: Member) => {
    // Members who have the app have a real userId via the member record.
    // We search by the member's linked user id (not memberId).
    // The member.id is the memberId; to add as friend we need the user UUID.
    // We'll search by name and send a friend request to matching user.
    setAddingFriend(m.id);
    try {
      const results = await endpoints.friends.search(m.name);
      if (!results.length) {
        setConfirmModal({
          visible: true,
          title: 'No match found',
          message: `Couldn't find a user named "${m.name}" to add as a friend. They may not have an account yet.`,
          confirmLabel: 'OK',
          onConfirm: () => {},
        });
        return;
      }
      // Take first match and send friend request
      await endpoints.friends.add(results[0].id);
      setAddedFriends(prev => new Set([...prev, m.id]));
    } catch (e) {
      setConfirmModal({
        visible: true,
        title: 'Could not add friend',
        message: errorMessage(e),
        confirmLabel: 'OK',
        onConfirm: () => {},
      });
    } finally {
      setAddingFriend(null);
    }
  };

  const memberActions = (m: Member) => {
    if (!owner) return;
    const options: typeof actionMenu.options = [
      {
        label: 'Rename',
        icon: 'pencil-outline',
        onPress: () => setPrompt({ kind: 'rename', member: m }),
      },
    ];

    if (!m.guest && m.role !== 'OWNER') {
      options.push({
        label: 'Unlink account (make guest)',
        icon: 'person-remove-outline',
        onPress: () =>
          setConfirmModal({
            visible: true,
            title: 'Unlink account?',
            message: `${m.name} will lose access, but all their expenses and shares stay.`,
            confirmLabel: 'Unlink',
            confirmVariant: 'danger',
            onConfirm: () => run(() => endpoints.trips.unlink(trip.id, m.id)),
          }),
      });
    }

    if (m.role !== 'OWNER') {
      options.push({
        label: 'Remove from trip',
        icon: 'trash-outline',
        destructive: true,
        onPress: () =>
          setConfirmModal({
            visible: true,
            title: 'Remove person?',
            message:
              'If they already have expenses, their history is kept and they are hidden from new expenses.',
            confirmLabel: 'Remove',
            confirmVariant: 'danger',
            onConfirm: () =>
              run(() => endpoints.trips.removeMember(trip.id, m.id)),
          }),
      });
    }

    setActionMenu({ visible: true, title: m.name, options });
  };

  const leave = () =>
    setConfirmModal({
      visible: true,
      title: 'Leave this trip?',
      message:
        'Your past expenses stay in the ledger. You will no longer see the trip.',
      confirmLabel: 'Leave',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await endpoints.trips.leave(trip.id);
          qc.invalidateQueries({ queryKey: ['trips'] });
          navigation.popToTop();
        } catch (e) {
          setConfirmModal({
            visible: true,
            title: 'Could not leave',
            message: errorMessage(e),
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        }
      },
    });

  const deleteTrip = () =>
    setConfirmModal({
      visible: true,
      title: 'Delete this trip?',
      message:
        'It disappears for everyone. This cannot be undone from the app.',
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await endpoints.trips.remove(trip.id);
          qc.invalidateQueries({ queryKey: ['trips'] });
          navigation.popToTop();
        } catch (e) {
          setConfirmModal({
            visible: true,
            title: 'Could not delete',
            message: errorMessage(e),
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        }
      },
    });

  const inviteCode = trip.inviteCode?.toUpperCase() ?? '';
  const shareUrl = inviteCode ? getShareUrl(inviteCode) : '';

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await qc.invalidateQueries({ queryKey: ['trip', trip.id] });
            setRefreshing(false);
          }}
        />
      }
    >
      {/* ── Join requests ─────────────────────────────────────────── */}
      {owner && trip.joinRequests.length > 0 ? (
        <>
          <SectionTitle>Waiting for your approval</SectionTitle>
          {trip.joinRequests.map((r) => (
            <Card key={r.memberId}>
              <Text style={type.heading}>{r.name}</Text>
              <Text style={[type.small, { marginVertical: space.sm }]}>
                {r.claimMemberName
                  ? `Says they are "${r.claimMemberName}" in this trip. Approving links their account to that person and keeps all their expenses.`
                  : 'Wants to join as a new person.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  title="Approve"
                  small
                  onPress={() =>
                    setConfirmModal({
                      visible: true,
                      title: 'Approve request?',
                      message: r.claimMemberName
                        ? `Link ${r.name}'s account to "${r.claimMemberName}" and keep all their expenses?`
                        : `Let ${r.name} join as a new member?`,
                      confirmLabel: 'Approve',
                      onConfirm: () =>
                        run(() =>
                          endpoints.trips.approve(trip.id, r.memberId),
                        ),
                    })
                  }
                />
                <Button
                  title="Decline"
                  small
                  variant="secondary"
                  onPress={() =>
                    setConfirmModal({
                      visible: true,
                      title: 'Decline request?',
                      message: `${r.name}'s request will be removed.`,
                      confirmLabel: 'Decline',
                      confirmVariant: 'danger',
                      onConfirm: () =>
                        run(() =>
                          endpoints.trips.reject(trip.id, r.memberId),
                        ),
                    })
                  }
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {/* ── People list ───────────────────────────────────────────── */}
      <SectionTitle>People in this trip</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>
        {people.map((m, i) => (
          <View
            key={m.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: space.md,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: colors.line,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar name={m.name} size={36} />
              <View>
                <Text style={type.body}>
                  {m.name}
                  {m.id === trip.myMemberId ? (
                    <Text style={{ color: colors.muted }}> (you)</Text>
                  ) : null}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
              {m.role === 'OWNER' ? (
                <Chip label="Owner" tone="good" />
              ) : null}
              {m.guest ? (
                <Chip label="Guest" tone="warn" />
              ) : (
                <>
                  <Chip label="On app" />
                  {/* "Add as friend" for non-self app members */}
                  {m.id !== trip.myMemberId && !addedFriends.has(m.id) ? (
                    <Button
                      title={addingFriend === m.id ? '…' : '+ Friend'}
                      small
                      variant="secondary"
                      loading={addingFriend === m.id}
                      onPress={() => addFriend(m)}
                    />
                  ) : m.id !== trip.myMemberId && addedFriends.has(m.id) ? (
                    <Chip label="✓ Sent" tone="good" />
                  ) : null}
                </>
              )}
              {owner && m.role !== 'OWNER' ? (
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '600',
                    paddingLeft: 4,
                    paddingVertical: 8,
                  }}
                  onPress={() => memberActions(m)}
                >
                  Edit
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      {/* ── Invite section ────────────────────────────────────────── */}
      {owner && trip.inviteCode ? (
        <>
          <SectionTitle>Invite friends who have the app</SectionTitle>
          <Card>
            {/* Invite code display */}
            <View
              style={{
                backgroundColor: colors.primarySoft,
                borderRadius: 10,
                padding: space.md,
                alignItems: 'center',
                marginBottom: space.md,
              }}
            >
              <Text style={[type.small, { marginBottom: 4 }]}>
                Invite code
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '800',
                  letterSpacing: 6,
                  color: colors.primaryDark,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {inviteCode}
              </Text>
              {shareUrl ? (
                <Text
                  style={[
                    type.small,
                    {
                      marginTop: 6,
                      color: colors.muted,
                      textAlign: 'center',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {shareUrl}
                </Text>
              ) : null}
            </View>

            <Text style={[type.small, { marginBottom: space.md }]}>
              Share the link or code. When someone opens it they can ask to
              join, and you approve. If they are already added by name, they
              can pick their name so their old expenses stay theirs.
            </Text>
            <Button
              title="Share invite"
              icon="share-outline"
              onPress={shareInvite}
            />
            <View style={{ height: space.sm }} />
            <Button
              title={copyFeedback ? '✓ Code copied!' : 'Copy code'}
              variant="secondary"
              icon="copy-outline"
              onPress={copyCode}
            />
            <View style={{ height: space.sm }} />
            <Button
              title="Reset link (old link stops working)"
              variant="ghost"
              onPress={() =>
                setConfirmModal({
                  visible: true,
                  title: 'Reset invite link?',
                  message: 'The old link and code will stop working immediately.',
                  confirmLabel: 'Reset',
                  confirmVariant: 'danger',
                  onConfirm: () =>
                    run(() => endpoints.trips.resetInvite(trip.id)),
                })
              }
            />
          </Card>
        </>
      ) : null}

      {/* ── Danger zone ───────────────────────────────────────────── */}
      <View style={{ marginTop: space.xl }}>
        {owner ? (
          <Button title="Delete trip" variant="danger" onPress={deleteTrip} />
        ) : (
          <Button title="Leave trip" variant="danger" onPress={leave} />
        )}
      </View>

      {/* ── PromptModal for rename / add person ───────────────────── */}
      <PromptModal
        visible={prompt !== null}
        title={
          prompt?.kind === 'rename'
            ? `Rename ${prompt.member.name}`
            : 'Add a person'
        }
        placeholder={
          prompt?.kind === 'rename' ? prompt.member.name : "Friend's name"
        }
        initial={prompt?.kind === 'rename' ? prompt.member.name : ''}
        confirmLabel={prompt?.kind === 'rename' ? 'Save' : 'Add'}
        autoCapitalize="words"
        onCancel={() => setPrompt(null)}
        onConfirm={(text) => {
          const p = prompt;
          setPrompt(null);
          if (!p) return;
          const capitalized = capitalizeWords(text);
          if (p.kind === 'add')
            run(() => endpoints.trips.addGuest(trip.id, capitalized));
          else
            run(() =>
              endpoints.trips.rename(trip.id, p.member.id, capitalized),
            );
        }}
      />

      {/* ── ActionMenuModal for member actions ────────────────────── */}
      <ActionMenuModal
        visible={actionMenu.visible}
        title={actionMenu.title}
        options={actionMenu.options}
        onCancel={() => setActionMenu((a) => ({ ...a, visible: false }))}
      />

      {/* ── ConfirmModal (replaces Alert.alert on web) ────────────── */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onCancel={() => setConfirmModal((c) => ({ ...c, visible: false }))}
        onConfirm={() => {
          const fn = confirmModal.onConfirm;
          setConfirmModal((c) => ({ ...c, visible: false }));
          fn();
        }}
      />
    </ScrollView>
  );
}
