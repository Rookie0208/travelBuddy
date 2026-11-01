import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { Button, Card, Chip, Field } from '../components/ui';
import { colors, radius, space, type } from '../theme';
import { capitalizeWords } from '../utils/format';
import type { Props } from '../navigation/types';

// ─── Inline Calendar ─────────────────────────────────────────────────────────
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateOrToday(iso: string | null): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

interface CalendarPickerProps {
  value: string;       // ISO date or ''
  minDate?: string;    // ISO date – days before this are disabled
  onChange: (iso: string) => void;
  onClose: () => void;
  title: string;
}

function CalendarPicker({ value, minDate, onChange, onClose, title }: CalendarPickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDay = minDate ? parseDateOrToday(minDate) : today;
  minDay.setHours(0, 0, 0, 0);

  const initial = value ? parseDateOrToday(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <View style={cal.container}>
      <Text style={[type.heading, { textAlign: 'center', marginBottom: space.md }]}>{title}</Text>

      {/* Month navigation */}
      <View style={cal.header}>
        <TouchableOpacity onPress={prevMonth} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[type.subheading, { flex: 1, textAlign: 'center' }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={cal.row}>
        {WEEK_DAYS.map(d => (
          <Text key={d} style={cal.weekDay}>{d}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={cal.cell} />;

          const iso = toIso(viewYear, viewMonth, day);
          const cellDate = new Date(viewYear, viewMonth, day);
          const isPast = cellDate < minDay;
          const isSelected = iso === value;
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();

          return (
            <TouchableOpacity
              key={iso}
              style={[
                cal.cell,
                isSelected && { backgroundColor: colors.primary, borderRadius: radius.full },
                !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.full },
                isPast && { opacity: 0.3 },
              ]}
              onPress={() => !isPast && onChange(iso)}
              disabled={isPast}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isSelected || isToday ? '700' : '400',
                  color: isSelected ? '#fff' : colors.ink,
                }}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ marginTop: space.lg, flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
        <Button title="Clear" variant="ghost" small onPress={() => { onChange(''); onClose(); }} />
        <Button title="Done" small onPress={onClose} />
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  container: { padding: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', marginBottom: space.xs },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 12,
    fontWeight: '600', color: colors.muted, paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── DateField ───────────────────────────────────────────────────────────────
function DateField({
  label,
  value,
  minDate,
  onSelect,
}: {
  label: string;
  value: string;
  minDate?: string;
  onSelect: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const display = value
    ? (() => {
        const [y, m, d] = value.split('-');
        return `${d} ${MONTHS[parseInt(m) - 1]} ${y}`;
      })()
    : 'Tap to pick';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          {
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: 14,
            marginBottom: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: pressed ? colors.lineLight : colors.card,
          },
        ]}
      >
        <View>
          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 2 }}>
            {label}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: value ? colors.ink : colors.subtle,
              fontWeight: value ? '600' : '400',
            }}
          >
            {display}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={e => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: 32,
            }}
          >
            <CalendarPicker
              title={label}
              value={value}
              minDate={minDate}
              onChange={v => { onSelect(v); }}
              onClose={() => setOpen(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreateTripScreen({ navigation }: Props<'CreateTrip'>) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [guests, setGuests] = useState<string[]>([]);
  const [changeCurrency, setChangeCurrency] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Computed today string for minDate
  const todayIso = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  // Validation
  const startInvalid = start && start < todayIso;
  const endInvalid = end && ((start && end < start) || end < todayIso);
  const valid =
    name.trim().length > 0 &&
    !startInvalid &&
    !endInvalid &&
    (!changeCurrency || /^[A-Za-z]{3}$/.test(currency));

  const addGuest = () => {
    const n = capitalizeWords(guestInput.trim());
    if (n) setGuests(g => [...g, n]);
    setGuestInput('');
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const pending = guestInput.trim()
        ? [...guests, capitalizeWords(guestInput.trim())]
        : guests;
      const trip = await endpoints.trips.create({
        name: capitalizeWords(name.trim()),
        destination: destination.trim() ? capitalizeWords(destination.trim()) : undefined,
        startDate: start || undefined,
        endDate: end || undefined,
        currency: changeCurrency ? currency.toUpperCase() : 'INR',
        guestNames: pending,
      });
      qc.invalidateQueries({ queryKey: ['trips'] });
      navigation.replace('Trip', { tripId: trip.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Field
        label="Trip name"
        value={name}
        onChangeText={setName}
        placeholder="Manali Trip"
        maxLength={100}
        autoCapitalize="words"
      />
      <Field
        label="Destination (optional)"
        value={destination}
        onChangeText={setDestination}
        maxLength={100}
        autoCapitalize="words"
      />

      {/* ── Date pickers ───────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <DateField
            label="Start date"
            value={start}
            minDate={todayIso}
            onSelect={v => {
              setStart(v);
              // If end is now before start, clear end
              if (end && v && end < v) setEnd('');
            }}
          />
          {startInvalid ? (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: -space.sm, marginBottom: space.sm }}>
              Can't be before today
            </Text>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <DateField
            label="End date"
            value={end}
            minDate={start || todayIso}
            onSelect={setEnd}
          />
          {endInvalid ? (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: -space.sm, marginBottom: space.sm }}>
              Must be after start date
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Who is coming ─────────────────────────────────────────── */}
      <Text style={[type.heading, { marginTop: space.sm }]}>Who is coming?</Text>
      <Text style={[type.small, { marginBottom: space.md }]}>
        You are added automatically. Add friends by name — they can join later
        via invite link and link to their name.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.sm }}>
        {guests.map((g, i) => (
          <Chip
            key={`${g}-${i}`}
            label={`${g}  ✕`}
            onPress={() => setGuests(arr => arr.filter((_, idx) => idx !== i))}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            value={guestInput}
            onChangeText={setGuestInput}
            placeholder="Friend's name"
            onSubmitEditing={addGuest}
            returnKeyType="done"
            maxLength={100}
            autoCapitalize="words"
          />
        </View>
        <Button title="Add" variant="secondary" onPress={addGuest} disabled={!guestInput.trim()} />
      </View>

      {/* ── Currency ──────────────────────────────────────────────── */}
      <View style={{ marginTop: space.sm, marginBottom: space.lg }}>
        {changeCurrency ? (
          <Field
            label="Currency code"
            value={currency}
            onChangeText={t => setCurrency(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
          />
        ) : (
          <Card style={{ padding: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={type.small}>Currency</Text>
              <Text style={{ fontWeight: '700', fontSize: 18, color: colors.ink }}>₹ INR</Text>
            </View>
            <Text
              style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}
              onPress={() => setChangeCurrency(true)}
            >
              Change
            </Text>
          </Card>
        )}
      </View>

      {error ? (
        <Text style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text>
      ) : null}
      <Button title="Create trip" onPress={submit} loading={busy} disabled={!valid} />
    </ScrollView>
  );
}
