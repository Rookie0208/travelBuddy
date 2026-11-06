import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveDefaultHost(): string {
  // If running in Expo Go or dev client, hostUri is "IP:port" of the Metro bundler machine
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
const normalized = raw ? raw.replace(/\/+$/, '').replace(/\/api\/v1$/, '') : `http://${resolveDefaultHost()}:8080`;

export const API_URL: string = normalized;
export const INVITE_SCHEME = 'tripsplit://join/';
export { FEATURES } from './config/features';

export function getShareUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${code.toUpperCase()}`;
  }
  return `https://tripsplit.app/join/${code.toUpperCase()}`;
}
