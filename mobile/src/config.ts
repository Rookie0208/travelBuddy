import { Platform } from 'react-native';

const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
const normalized = raw ? raw.replace(/\/+$/, '').replace(/\/api\/v1$/, '') : `http://${devHost}:8080`;

export const API_URL: string = normalized;
export const INVITE_SCHEME = 'tripsplit://join/';

export function getShareUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/join/${code.toUpperCase()}`;
  }
  return `https://tripsplit.app/join/${code.toUpperCase()}`;
}
