import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { JoinPreview } from '../api/types';
import { Button, Card, Chip, Field, Loading } from '../components/ui';
import { colors, space, type } from '../theme';
import { extractInviteCode } from '../utils/format';
import type { Props } from '../navigation/types';

export default function JoinScreen({ route, navigation }: Props<'Join'>) {
  const qc = useQueryClient();
  const initial = route.params?.code ?? '';
  const [input, setInput] = useState(initial);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [claim, setClaim] = useState<string | null>(null);   // null = "I'm someone new"
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const code = extractInviteCode(input);

  const find = async (c: string) => {
    setError('');
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await endpoints.trips.joinPreview(c));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (initial) find(extractInviteCode(initial)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await endpoints.trips.join(code, claim);
      setSent(true);
      qc.invalidateQueries({ queryKey: ['trips'] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
      {/* Section Header */}
      <View style={{ marginBottom: space.lg }}>
        <Text style={type.caption}>JOIN A FRIEND</Text>
        <Text style={[type.largeTitle, { fontSize: 26, marginTop: 2 }]}>Enter Trip Code</Text>
      </View>

      <Field
        label="Invite link or code"
        value={input}
        onChangeText={(v) => setInput(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Paste a link or enter 6-digit code"
      />
      {/* Show nicely formatted code when it looks like a bare code */}
      {code && !input.includes('://') && !input.includes('http') ? (
        <Text style={{ letterSpacing: 4, fontWeight: '800', fontSize: 22, textAlign: 'center', color: colors.primaryDark, marginBottom: space.md }}>
          {code}
        </Text>
      ) : null}
      <Button title="Find trip" variant="secondary" onPress={() => find(code)} disabled={!code} loading={loading} />
      {error ? <Text style={{ color: colors.danger, marginTop: space.md }}>{error}</Text> : null}
      {loading ? <Loading /> : null}

      {preview ? (
        <View style={{ marginTop: space.xl }}>
          <Card>
            <Text style={type.title}>{preview.tripName}</Text>
            <Text style={[type.small, { marginTop: 4 }]}>Created by {preview.ownerName}</Text>
          </Card>

          {preview.myStatus === 'ACTIVE' ? (
            <Button title="You are already in this trip. Open it" onPress={() => navigation.replace('Trip', { tripId: preview.tripId })} />
          ) : preview.myStatus === 'PENDING' || sent ? (
            <Card style={{ backgroundColor: colors.warnSoft, borderColor: colors.warnSoft }}>
              <Text style={{ fontWeight: '700', color: colors.warn }}>Request sent</Text>
              <Text style={type.small}>{preview.ownerName} needs to approve you. You will get a notification, and the trip will appear in your list.</Text>
            </Card>
          ) : (
            <>
              <Text style={[type.heading, { marginBottom: space.sm }]}>Who are you in this trip?</Text>
              <Text style={[type.small, { marginBottom: space.md }]}>
                If {preview.ownerName} already added you by name, pick it so your earlier expenses stay yours. The owner confirms before anything is linked.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {preview.claimableMembers.map((m) => (
                  <Chip key={m.id} label={`I'm ${m.name}`} selected={claim === m.id} onPress={() => setClaim(m.id)} />
                ))}
                <Chip label="I'm someone new" selected={claim === null} onPress={() => setClaim(null)} />
              </View>
              <Button title="Ask to join" onPress={send} loading={busy} style={{ marginTop: space.lg }} />
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
