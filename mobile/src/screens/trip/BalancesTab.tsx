import React, { useCallback, useState } from 'react';
import {
  Animated, LayoutAnimation, Platform, RefreshControl,
  ScrollView, Text, TouchableOpacity, UIManager, View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as endpoints from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { Balance, Expense, Transfer, TripDetail } from '../../api/types';
import { Avatar, Button, Card, Chip, ConfirmModal, ErrorState, Loading, SectionTitle } from '../../components/ui';
import { invalidateTrip } from '../../queries';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../../theme';
import { formatWhen } from '../../utils/format';
import { formatPaise, previewShares } from '../../utils/money';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Dropdown row showing all expenses a member was involved in */
function MemberExpenseDropdown({
  member,
  expenses,
  money,
}: {
  member: Balance;
  expenses: Expense[];
  money: (p: number) => string;
}) {
  // Expenses paid by this member
  const paid = expenses.filter((e) => e.paidBy === member.memberId);
  // Expenses this member shares in (but didn't pay)
  const shared = expenses.filter(
    (e) =>
      e.paidBy !== member.memberId &&
      e.splits.some((s) => s.memberId === member.memberId),
  );

  const getMemberShare = (e: Expense): number => {
    const split = e.splits.find((s) => s.memberId === member.memberId);
    return split ? split.sharePaise : 0;
  };

  return (
    <View
      style={{
        backgroundColor: colors.primarySoft,
        borderRadius: 10,
        marginTop: 8,
        padding: space.md,
        gap: space.sm,
      }}
    >
      {/* Paid section */}
      {paid.length > 0 && (
        <View>
          <Text
            style={[
              type.small,
              { fontWeight: '700', color: colors.good, marginBottom: 4 },
            ]}
          >
            🟢 Paid for
          </Text>
          {paid.map((e) => (
            <View
              key={e.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 3,
              }}
            >
              <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={[type.small, { fontWeight: '600', color: colors.good }]}>
                {money(e.amountPaise)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Shared section */}
      {shared.length > 0 && (
        <View>
          <Text
            style={[
              type.small,
              { fontWeight: '700', color: colors.danger, marginBottom: 4 },
            ]}
          >
            🔴 Owes share of
          </Text>
          {shared.map((e) => {
            const shareAmt = getMemberShare(e);
            return (
              <View
                key={e.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 3,
                }}
              >
                <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
                  {e.title}
                  <Text style={{ color: colors.muted }}>
                    {' '}(paid by {e.paidByName})
                  </Text>
                </Text>
                <Text
                  style={[
                    type.small,
                    { fontWeight: '600', color: colors.danger },
                  ]}
                >
                  {money(shareAmt)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Summary row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <Text style={[type.small, { fontWeight: '600' }]}>
          Paid {money(member.paidPaise)} · Share {money(member.sharePaise)}
        </Text>
        <Text
          style={[
            type.small,
            {
              fontWeight: '700',
              color:
                member.netPaise > 0
                  ? colors.good
                  : member.netPaise < 0
                  ? colors.danger
                  : colors.muted,
            },
          ]}
        >
          {member.netPaise > 0
            ? `gets back ${money(member.netPaise)}`
            : member.netPaise < 0
            ? `owes ${money(-member.netPaise)}`
            : 'even'}
        </Text>
      </View>

      {paid.length === 0 && shared.length === 0 && (
        <Text style={[type.small, { color: colors.muted, textAlign: 'center' }]}>
          No expenses recorded yet.
        </Text>
      )}
    </View>
  );
}

export default function BalancesTab({ trip }: { trip: TripDetail }) {
  const qc = useQueryClient();
  const owner = trip.myRole === 'OWNER';

  const bal = useQuery({
    queryKey: ['balances', trip.id],
    queryFn: () => endpoints.ledger.balances(trip.id),
  });
  const stats = useQuery({
    queryKey: ['stats', trip.id],
    queryFn: () => endpoints.ledger.stats(trip.id),
  });
  // Fetch all expenses for the dropdown detail view
  const expQ = useQuery({
    queryKey: ['expenses-all', trip.id],
    queryFn: () => endpoints.ledger.expenses(trip.id, 0),
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // ConfirmModal state
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger';
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = useCallback(
    (cfg: {
      title: string;
      message: string;
      confirmLabel?: string;
      confirmVariant?: 'danger';
      onConfirm: () => void;
    }) => {
      setConfirmModal({ visible: true, ...cfg });
    },
    [],
  );
  const hideConfirm = () =>
    setConfirmModal((c) => ({ ...c, visible: false }));

  if (bal.isLoading) return <Loading />;
  if (bal.isError || !bal.data)
    return (
      <ErrorState
        message={errorMessage(bal.error)}
        onRetry={() => bal.refetch()}
      />
    );

  const b = bal.data;
  const money = (p: number) => formatPaise(p, b.currency);
  const settled = b.status === 'SETTLED';
  const allExpenses: Expense[] = expQ.data?.items ?? [];

  const toggleMember = (memberId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMemberId((prev) => (prev === memberId ? null : memberId));
  };

  const record = (t: Transfer) => {
    showConfirm({
      title: 'Record repayment',
      message: `${t.fromName} paid ${t.toName} ${money(t.amountPaise)}?`,
      confirmLabel: 'Record',
      onConfirm: async () => {
        setBusy(`${t.fromMemberId}-${t.toMemberId}`);
        try {
          await endpoints.ledger.recordSettlement(trip.id, {
            requestId: Crypto.randomUUID(),
            fromMember: t.fromMemberId,
            toMember: t.toMemberId,
            amount: (t.amountPaise / 100).toFixed(2),
          });
          invalidateTrip(qc, trip.id);
        } catch (e) {
          showConfirm({
            title: 'Could not record',
            message: errorMessage(e),
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const finish = () => {
    showConfirm({
      title: 'Mark trip as settled?',
      message: 'This records that all balances have been cleared. You can reopen later.',
      confirmLabel: 'Mark settled',
      onConfirm: async () => {
        setBusy('settle');
        try {
          await endpoints.ledger.markSettled(trip.id);
          invalidateTrip(qc, trip.id);
        } catch (e) {
          showConfirm({
            title: 'Cannot mark as settled',
            message: errorMessage(e),
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const reopen = () => {
    showConfirm({
      title: 'Reopen trip?',
      message: 'This will reopen the trip for recording new expenses and settlements.',
      confirmLabel: 'Reopen',
      onConfirm: async () => {
        setBusy('settle');
        try {
          await endpoints.ledger.reopen(trip.id);
          invalidateTrip(qc, trip.id);
        } catch (e) {
          showConfirm({
            title: 'Could not reopen',
            message: errorMessage(e),
            confirmLabel: 'OK',
            onConfirm: () => {},
          });
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const maxCat = Math.max(1, ...Object.values(stats.data?.byCategory ?? {}));
  const perHead =
    b.members.length
      ? previewShares(b.totalSpentPaise, b.members.length)[0]
      : 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={bal.isRefetching}
          onRefresh={() => {
            bal.refetch();
            stats.refetch();
            expQ.refetch();
          }}
        />
      }
    >
      {/* ── Summary card: Velto Style ──────────────────────────── */}
      <View
        style={{
          backgroundColor: '#0A1813',
          borderRadius: radius.xl,
          padding: space.xl,
          borderWidth: 1.5,
          borderColor: '#1D3B2E',
          marginBottom: space.lg,
          shadowColor: '#071610',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.2,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.6 }}>
          TOTAL TRIP EXPENDITURE
        </Text>
        <Text
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.8,
            marginVertical: space.xs,
          }}
        >
          {money(b.totalSpentPaise)}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
          About {money(perHead)} per person if shared equally
        </Text>
        {settled ? (
          <View style={{ flexDirection: 'row', marginTop: space.md }}>
            <View
              style={{
                backgroundColor: 'rgba(212, 255, 0, 0.15)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: 'rgba(212, 255, 0, 0.3)',
              }}
            >
              <Text style={{ color: '#D4FF00', fontSize: 11, fontWeight: '800' }}>TRIP SETTLED</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* ── Who owes whom ─────────────────────────────────────────── */}
      <SectionTitle>Who owes whom</SectionTitle>
      <Text style={[type.small, { marginBottom: space.sm, marginTop: -space.xs }]}>
        Tap a name to see their expense breakdown
      </Text>
      <Card>
        {b.members.map((m, i) => {
          const isExpanded = expandedMemberId === m.memberId;
          return (
            <View
              key={m.memberId}
              style={{
                paddingVertical: space.sm,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: colors.line,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleMember(m.memberId)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Avatar name={m.name} size={32} />
                  <View>
                    <Text
                      style={[
                        type.body,
                        {
                          color: isExpanded ? colors.primary : colors.ink,
                          fontWeight: isExpanded ? '700' : '600',
                        },
                      ]}
                    >
                      {m.name}
                      {m.guest ? ' (guest)' : ''}
                    </Text>
                    {m.memberId === trip.myMemberId && (
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>You</Text>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color:
                        m.netPaise > 0
                          ? colors.good
                          : m.netPaise < 0
                          ? colors.danger
                          : colors.muted,
                    }}
                  >
                    {m.netPaise > 0
                      ? `gets ${money(m.netPaise)}`
                      : m.netPaise < 0
                      ? `owes ${money(-m.netPaise)}`
                      : 'settled'}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isExpanded ? '▲' : '▼'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <MemberExpenseDropdown
                  member={m}
                  expenses={allExpenses}
                  money={money}
                />
              )}
            </View>
          );
        })}
      </Card>

      {/* ── Suggested repayments ──────────────────────────────────── */}
      <SectionTitle>Suggested repayments</SectionTitle>
      {b.suggested.length === 0 ? (
        <Text style={type.small}>Nothing to repay. Everyone is even.</Text>
      ) : (
        b.suggested.map((t) => (
          <Card
            key={`${t.fromMemberId}-${t.toMemberId}`}
            style={{ paddingVertical: space.md }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Avatar name={t.fromName} size={24} />
                  <Ionicons name="arrow-forward" size={13} color={colors.subtle} />
                  <Avatar name={t.toName} size={24} />
                  <Text style={[type.subheading, { color: colors.ink }]} numberOfLines={1}>
                    {t.fromName} pays {t.toName}
                  </Text>
                </View>
                <Text
                  style={{
                    fontWeight: '800',
                    fontSize: 18,
                    color: colors.primaryDark,
                  }}
                >
                  {money(t.amountPaise)}
                </Text>
              </View>
              {owner && !settled ? (
                <Button
                  title="Mark paid"
                  small
                  variant="secondary"
                  loading={busy === `${t.fromMemberId}-${t.toMemberId}`}
                  onPress={() => record(t)}
                />
              ) : null}
            </View>
          </Card>
        ))
      )}
      <Text style={[type.small, { marginTop: 2 }]}>
        The app only suggests who should pay whom. Payments happen outside the
        app.
      </Text>

      {/* ── Recorded repayments ───────────────────────────────────── */}
      {b.settlements.length > 0 ? (
        <>
          <SectionTitle>Recorded repayments</SectionTitle>
          {b.settlements.map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
              }}
            >
              <Text style={type.body}>
                {s.fromName} → {s.toName}
              </Text>
              <Text style={type.body}>
                {money(s.amountPaise)}{' '}
                <Text style={type.small}>{formatWhen(s.createdAt)}</Text>
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {/* ── Owner actions ─────────────────────────────────────────── */}
      {owner ? (
        <View style={{ marginTop: space.xl }}>
          {settled ? (
            <Button
              title="Reopen trip"
              variant="secondary"
              onPress={reopen}
              loading={busy === 'settle'}
            />
          ) : (
            <Button
              title="Mark trip as settled"
              onPress={finish}
              loading={busy === 'settle'}
              disabled={!b.allSettled}
            />
          )}
          {!settled && !b.allSettled ? (
            <Text
              style={[
                type.small,
                { marginTop: space.sm, textAlign: 'center' },
              ]}
            >
              Available once everyone is even.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Category breakdown ────────────────────────────────────── */}
      {stats.data && Object.keys(stats.data.byCategory).length > 0 ? (
        <>
          <SectionTitle>Spending by category</SectionTitle>
          <Card>
            {Object.entries(stats.data.byCategory)
              .sort((a, c) => c[1] - a[1])
              .map(([cat, paise]) => (
                <View key={cat} style={{ marginBottom: space.md }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={type.body}>
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </Text>
                    <Text style={type.body}>{money(paise)}</Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: colors.primarySoft,
                      borderRadius: 4,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        height: 8,
                        width: `${Math.max(3, (paise / maxCat) * 100)}%`,
                        backgroundColor: colors.primary,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ))}
          </Card>

          <SectionTitle>Spending by day</SectionTitle>
          <Card>
            {Object.entries(stats.data.byDay).map(([day, paise]) => (
              <View
                key={day}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 4,
                }}
              >
                <Text style={type.body}>{day}</Text>
                <Text style={type.body}>{money(paise)}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* ── Confirm modal (replaces Alert.alert on web) ───────────── */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        confirmVariant={confirmModal.confirmVariant}
        onCancel={hideConfirm}
        onConfirm={() => {
          hideConfirm();
          confirmModal.onConfirm();
        }}
      />
    </ScrollView>
  );
}
