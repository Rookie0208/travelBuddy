import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as endpoints from '../api/endpoints';
import { errorCode, errorMessage } from '../api/client';
import { Avatar, Button, Card, ErrorState, Field, Loading } from '../components/ui';
import { invalidateTrip } from '../queries';
import { colors, radius, shadows, space, type } from '../theme';
import { isIsoDate, todayIso } from '../utils/format';
import { formatPaise, parseAmountToPaise, previewShares } from '../utils/money';
import type { Props } from '../navigation/types';

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'FOOD', label: 'Food', icon: '🍕' },
  { key: 'STAY', label: 'Stay', icon: '🏨' },
  { key: 'TRANSPORT', label: 'Ride', icon: '🚗' },
  { key: 'FUEL', label: 'Fuel', icon: '⛽' },
  { key: 'ACTIVITIES', label: 'Activity', icon: '🎟️' },
  { key: 'SHOPPING', label: 'Shopping', icon: '🛍️' },
  { key: 'OTHER', label: 'General', icon: '🧾' },
];

export default function ExpenseFormScreen({ route, navigation }: Props<'ExpenseForm'>) {
  const { tripId, expense } = route.params;
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: ['trip', tripId], queryFn: () => endpoints.trips.get(tripId) });

  const requestId = useRef(Crypto.randomUUID()).current;

  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? expense.amount : '');
  const [paidBy, setPaidBy] = useState<string | null>(expense?.paidBy ?? null);
  const [selected, setSelected] = useState<string[] | null>(
    expense ? expense.splits.map((s) => s.memberId) : null
  );
  const [category, setCategory] = useState(expense?.category ?? 'FOOD');
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const data = trip.data;
  const people = useMemo(() => {
    if (!data) return [];
    const keep = new Set([expense?.paidBy, ...(expense?.splits.map((s) => s.memberId) ?? [])]);
    return data.members.filter((m) => !m.left || keep.has(m.id));
  }, [data, expense]);

  if (trip.isLoading) return <Loading />;
  if (trip.isError || !data) {
    return <ErrorState message={errorMessage(trip.error)} onRetry={() => trip.refetch()} />;
  }

  const payer = paidBy ?? data.myMemberId;
  const sharers = selected ?? people.map((p) => p.id);
  const paise = parseAmountToPaise(amount);
  const preview = paise ? previewShares(paise, sharers.length) : [];

  const toggle = (id: string) => {
    const current = new Set(sharers);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setSelected(people.filter((p) => current.has(p.id)).map((p) => p.id));
  };

  const valid = title.trim().length > 0 && paise !== null && sharers.length > 0 && isIsoDate(date);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const body = {
        requestId,
        title: title.trim(),
        amount: ((paise ?? 0) / 100).toFixed(2),
        paidBy: payer,
        splitAmong: sharers,
        category,
        date,
        version: expense?.version,
      };
      if (expense) await endpoints.ledger.updateExpense(tripId, expense.id, body);
      else await endpoints.ledger.createExpense(tripId, body);
      invalidateTrip(qc, tripId);
      if (expense) navigation.popTo('Trip', { tripId });
      else navigation.goBack();
    } catch (e) {
      if (errorCode(e) === 'EXPENSE_CONFLICT') {
        invalidateTrip(qc, tripId);
        Alert.alert(
          'Someone else changed this',
          'This expense was edited by another member. Reload it and retry.',
          [{ text: 'Go back', onPress: () => navigation.popTo('Trip', { tripId }) }]
        );
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Hero Amount Display Card */}
      <View style={styles.heroAmountBox}>
        <Text style={styles.heroAmountCurrency}>{data.currency}</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.heroAmountInput}
          autoFocus={!expense}
        />
        <Text style={styles.heroAmountHint}>Enter the total paid bill</Text>
      </View>

      {/* 2. Expense Title */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>WHAT WAS IT FOR?</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Dinner, Fuel, Hotel booking"
          placeholderTextColor={colors.subtle}
          maxLength={150}
          style={styles.titleInput}
        />
      </View>

      {/* 3. Category Selector */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable
                key={c.key}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Who Paid? */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>WHO PAID THE BILL?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => {
            const isPayer = payer === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPaidBy(p.id)}
                style={[styles.memberPill, isPayer && styles.memberPillActive]}
              >
                <Avatar name={p.name} size={24} />
                <Text style={[styles.memberPillText, isPayer && styles.memberPillTextActive]}>
                  {p.name}
                </Text>
                {isPayer && (
                  <Ionicons name="checkmark-circle" size={14} color="#08251C" style={{ marginLeft: 2 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 5. Who Shares It? */}
      <View style={styles.formSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>WHO SHARES IT? ({sharers.length})</Text>
          <TouchableOpacity
            onPress={() => setSelected(people.map((p) => p.id))}
            hitSlop={6}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Select Everyone</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => {
            const inSplit = sharers.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                style={[styles.memberPill, inSplit && styles.memberPillShared]}
              >
                <Avatar name={p.name} size={24} />
                <Text style={[styles.memberPillText, inSplit && { color: colors.primary, fontWeight: '700' }]}>
                  {p.name}
                </Text>
                {inSplit ? (
                  <Ionicons name="checkbox" size={16} color={colors.primary} />
                ) : (
                  <Ionicons name="square-outline" size={16} color={colors.subtle} />
                )}
              </Pressable>
            );
          })}
        </View>

        {paise && sharers.length > 0 && (
          <View style={styles.splitLiveBanner}>
            <Ionicons name="flash" size={15} color="#D4FF00" />
            <Text style={styles.splitLiveText}>
              {formatPaise(preview[0], data.currency)} per person ({sharers.length} {sharers.length === 1 ? 'member' : 'members'})
            </Text>
          </View>
        )}
      </View>

      {/* 6. Date */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>EXPENSE DATE</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.subtle}
          style={styles.dateInput}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Submit Button */}
      <TouchableOpacity
        onPress={submit}
        disabled={!valid || busy}
        style={[styles.submitButton, !valid && { opacity: 0.5 }]}
        activeOpacity={0.88}
      >
        <Text style={styles.submitButtonText}>
          {expense ? 'Save Changes' : 'Record Expense'}
        </Text>
        <Ionicons name="arrow-forward" size={18} color="#08251C" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space.lg,
    paddingBottom: 60,
    backgroundColor: '#F8F9FA',
  },
  heroAmountBox: {
    backgroundColor: '#0A1813',
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    marginBottom: space.lg,
    borderWidth: 1.5,
    borderColor: '#1D3B2E',
    ...shadows.md,
  },
  heroAmountCurrency: {
    color: '#D4FF00',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmountInput: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
    minWidth: 200,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
  },
  heroAmountHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 6,
  },
  formSection: {
    marginBottom: space.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600',
    ...shadows.sm,
  },
  dateInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineLight,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    ...shadows.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  categoryPillActive: {
    backgroundColor: '#0D382A',
    borderColor: '#0D382A',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  categoryPillTextActive: {
    color: '#D4FF00',
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lineLight,
    ...shadows.sm,
  },
  memberPillActive: {
    backgroundColor: '#D4FF00',
    borderColor: '#D4FF00',
  },
  memberPillShared: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
  },
  memberPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  memberPillTextActive: {
    color: '#08251C',
    fontWeight: '700',
  },
  splitLiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0A1813',
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: space.sm,
  },
  splitLiveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: space.md,
  },
  submitButton: {
    backgroundColor: '#D4FF00',
    height: 52,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.sm,
    ...shadows.md,
  },
  submitButtonText: {
    color: '#08251C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
