import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Field } from '../components/ui';
import { colors, space, type } from '../theme';
import type { Props } from '../navigation/types';

export default function VerifyEmailScreen({ route }: Props<'Verify'>) {
  const { email } = route.params;
  const { completeAuth } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await completeAuth(await endpoints.auth.verify(email, code.trim()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      await endpoints.auth.resend(email);
      setInfo('A new code has been sent.');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
      <Text style={[type.title, { marginBottom: space.sm }]}>Check your email</Text>
      <Text style={[type.body, { color: colors.muted, marginBottom: space.xl }]}>
        We sent a 6-digit code to {email}. It expires in 10 minutes.
      </Text>
      <Field label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}
             style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }} />
      {error ? <Text style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text> : null}
      {info ? <Text style={{ color: colors.good, marginBottom: space.md }}>{info}</Text> : null}
      <Button title="Verify and continue" onPress={submit} loading={busy} disabled={code.trim().length !== 6} />
      <Button title="Send a new code" variant="ghost" onPress={resend} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}
