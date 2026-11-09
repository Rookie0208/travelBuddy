import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/ui';
import { colors } from '../theme';
import { listenToPush, registerForPush } from '../push';
import type { RootStackParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import TripsScreen from '../screens/TripsScreen';
import CreateTripScreen from '../screens/CreateTripScreen';
import TripScreen from '../screens/TripScreen';
import TripAnalyticsScreen from '../screens/TripAnalyticsScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import JoinScreen from '../screens/JoinScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navRef = createNavigationContainerRef<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

function codeFromUrl(url: string | null): string | null {
  const target = url || (typeof window !== 'undefined' && window.location?.href ? window.location.href : null);
  if (!target) return null;
  const m = target.match(/join\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'https://travelbuddy-mobile.vercel.app',
    'http://localhost:8081',
    'http://localhost:19006',
  ],
  config: {
    screens: {
      Join: 'join/:code',
      Trips: '',
      Trip: 'trips/:tripId',
      Profile: 'profile',
      Login: 'login',
      Register: 'register',
      Verify: 'verify',
    },
  },
};

export default function RootNavigator() {
  const { user, booting } = useAuth();
  const qc = useQueryClient();
  const url = Linking.useURL();
  const pendingCode = useRef<string | null>(codeFromUrl(url));

  // Remember an invite link even if the user still has to log in.
  useEffect(() => {
    const code = codeFromUrl(url);
    if (code) pendingCode.current = code;
  }, [url]);

  useEffect(() => {
    if (!user) return;
    registerForPush();
    return listenToPush(qc, (tripId) => { if (navRef.isReady()) navRef.navigate('Trip', { tripId }); });
  }, [user, qc]);

  const openPendingInvite = () => {
    if (user && pendingCode.current && navRef.isReady()) {
      const code = pendingCode.current;
      pendingCode.current = null;
      navRef.navigate('Join', { code });
    }
  };
  useEffect(openPendingInvite, [user, url]); // eslint-disable-line react-hooks/exhaustive-deps

  if (booting) return <Loading />;

  return (
    <NavigationContainer ref={navRef} linking={linking} onReady={openPendingInvite}>
      <Stack.Navigator screenOptions={screenOptions}>
        {user ? (
          <>
            <Stack.Screen name="Trips" component={TripsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} options={{ title: '' }} />
            <Stack.Screen name="Trip" component={TripScreen} options={{ title: '' }} />
            <Stack.Screen name="TripAnalytics" component={TripAnalyticsScreen} options={{ title: '' }} />
            <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: '' }} />
            <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="Join" component={JoinScreen} options={{ title: '' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: '' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '' }} />
            <Stack.Screen name="Verify" component={VerifyEmailScreen} options={{ title: '' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
