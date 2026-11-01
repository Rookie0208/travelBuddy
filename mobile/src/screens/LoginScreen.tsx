import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as endpoints from '../api/endpoints';
import { errorCode, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Field } from '../components/ui';
import { colors, space, type } from '../theme';
import type { Props } from '../navigation/types';

export default function LoginScreen({ navigation }: Props<'Login'>) {
  const { completeAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await completeAuth(await endpoints.auth.login(email.trim(), password));
    } catch (e) {
      if (errorCode(e) === 'EMAIL_NOT_VERIFIED') {
        await endpoints.auth.resend(email.trim()).catch(() => undefined);
        navigation.navigate('Verify', { email: email.trim() });
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xl, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primaryDark }}>TripSplit</Text>
          <Text style={[type.body, { marginTop: space.sm, marginBottom: space.xl, color: colors.muted }]}>
            Track trip expenses with friends, even the ones who are not on the app.
          </Text>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {error ? <Text style={{ color: colors.danger, marginBottom: space.md }}>{error}</Text> : null}
          <Button title="Log in" onPress={submit} loading={busy} disabled={!email.trim() || !password} />
          <View style={{ height: space.md }} />
          <Button title="Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
