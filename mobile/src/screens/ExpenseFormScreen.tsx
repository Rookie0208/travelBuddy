import React, { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as endpoints from '../api/endpoints';
import { errorCode, errorMessage } from '../api/client';
import { Button, Card, Chip, ErrorState, Field, Loading, SectionTitle } from '../components/ui';
import { invalidateTrip } from '../queries';
import { colors, space, type } from '../theme';
import { isIsoDate, todayIso } from '../utils/format';
import { formatPaise, parseAmountToPaise, previewShares } from '../utils/money';
import type { Props } from '../navigation/types';

const CATEGORIES = ['FOOD', 'STAY', 'TRANSPORT', 'FUEL', 'ACTIVITIES', 'SHOPPING', 'OTHER'];

export default function ExpenseFormScreen({ route, navigation }: Props<'ExpenseForm'>) {
  const { tripId, expense } = route.params;
  const qc = useQueryClient();
  const trip = useQuery({ queryKey: ['trip', tripId], queryFn: () => endpoints.trips.get(tripId) });

  // One id per form: if the request is retried after a network failure, the server will not create a duplicate.
  const requestId = useRef(Crypto.randomUUID()).current;

  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense ? expense.amount : '');
  const [paidBy, setPaidBy] = useState<string | null>(expense?.paidBy ?? null);
  const [selected, setSelected] = useState<string[] | null>(expense ? expense.splits.map((s) => s.memberId) : null);
  const [category, setCategory] = useState(expense?.category ?? 'FOOD');
  const [date, setDate] = useState(expense?.date ?? todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const data = trip.data;
  // People who can be picked: current members, plus anyone already on this expense (e.g. someone who left later).
  const people = useMemo(() => {
    if (!data) return [];
    const keep = new Set([expense?.paidBy, ...(expense?.splits.map((s) => s.memberId) ?? [])]);
    return data.members.filter((m) => !m.left || keep.has(m.id));
  }, [data, expense]);

  if (trip.isLoading) return <Loading />;
  if (trip.isError || !data) return <ErrorState message={errorMessage(trip.error)} onRetry={() => trip.refetch()} />;

  const payer = paidBy ?? data.myMemberId;
  const sharers = selected ?? people.map((p) => p.id);   // default: everyone shares
  const paise = parseAmountToPaise(amount);
  const preview = paise ? previewShares(paise, sharers.length) : [];

  const toggle = (id: string) => {
    const current = new Set(sharers);
    if (current.has(id)) current.delete(id); else current.add(id);
    setSelected(people.filter((p) => current.has(p.id)).map((p) => p.id));
  };

  const valid = title.trim().length > 0 && paise !== null && sharers.length > 0 && isIsoDate(date);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const body = {
        requestId, title: title.trim(), amount: ((paise ?? 0) / 100).toFixed(2), paidBy: payer,
        splitAmong: sharers, category, date, version: expense?.version,
      };
      if (expense) await endpoints.ledger.updateExpense(tripId, expense.id, body);
      else await endpoints.ledger.createExpense(tripId, body);
      invalidateTrip(qc, tripId);
      if (expense) navigation.popTo('Trip', { tripId }); else navigation.goBack();
    } catch (e) {
      if (errorCode(e) === 'EXPENSE_CONFLICT') {
        invalidateTrip(qc, tripId);
        Alert.alert('Someone else changed this', 'This expense was edited by another member. Go back, open it again, and redo your change.', [
          { text: 'Go back', onPress: () => navigation.popTo('Trip', { tripId }) },
        ]);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Field label="What was it for?" value={title} onChangeText={setTitle} placeholder="Dinner at the dhaba" maxLength={150} autoCapitalize="sentences" />
      <Field
        label={`Amount (${data.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1200"
        error={amount && paise === null ? 'Enter an amount like 1200 or 1200.50' : undefined}
      />

      <Text style={[type.small, { fontWeight: '600', marginBottom: 6 }]}>Who paid?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {people.map((p) => <Chip key={p.id} label={p.name} selected={payer === p.id} onPress={() => setPaidBy(p.id)} />)}
      </View>

      <SectionTitle>Who shares it?</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Everyone" onPress={() => setSelected(people.map((p) => p.id))} />
        {people.map((p) => <Chip key={p.id} label={p.name} selected={sharers.includes(p.id)} onPress={() => toggle(p.id)} />)}
      </View>

      {paise && sharers.length > 0 ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={{ fontWeight: '700', color: colors.primaryDark }}>
            {formatPaise(preview[0], data.currency)} each{preview[0] !== preview[preview.length - 1] ? ' (a few get 1 paisa less)' : ''}
          </Text>
          <Text style={type.small}>Split equally among {sharers.length} {sharers.length === 1 ? 'person' : 'people'}. The app handles the rounding.</Text>
        </Card>
      ) : null}

      <SectionTitle>Category</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => <Chip key={c} label={c.charAt(0) + c.slice(1).toLowerCase()} selected={category === c} onPress={() => setCategory(c)} />)}
      </View>

      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"
             error={!isIsoDate(date) ? 'Use YYYY-MM-DD' : undefined} />

      {error ? <Text style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text> : null}
      <Button title={expense ? 'Save changes' : 'Add expense'} onPress={submit} loading={busy} disabled={!valid} />
    </ScrollView>
  );
}
