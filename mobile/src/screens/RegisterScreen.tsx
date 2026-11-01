import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/client';
import { Button, Field } from '../components/ui';
import { colors, space, type } from '../theme';
import type { Props } from '../navigation/types';

export default function RegisterScreen({ navigation }: Props<'Register'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && password.length >= 8;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await endpoints.auth.register(name.trim(), email.trim(), password);
      navigation.navigate('Verify', { email: email.trim() });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
      <Text style={[type.title, { marginBottom: space.xl }]}>Create your account</Text>
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text> : null}
      <Button title="Send verification code" onPress={submit} loading={busy} disabled={!valid} />
    </ScrollView>
  );
}
