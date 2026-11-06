import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import type { AuthResponse } from './types';

const ACCESS = 'accessToken';
const REFRESH = 'refreshToken';

/** Tokens live in secure storage on native devices, and localStorage on web. */
export const tokenStore = {
  getAccess: () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return Promise.resolve(window.localStorage.getItem(ACCESS));
    }
    return SecureStore.getItemAsync(ACCESS);
  },
  getRefresh: () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return Promise.resolve(window.localStorage.getItem(REFRESH));
    }
    return SecureStore.getItemAsync(REFRESH);
  },
  save: async (access: string, refresh: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS, access);
      window.localStorage.setItem(REFRESH, refresh);
      return;
    }
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },
  clear: async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(ACCESS);
      window.localStorage.removeItem(REFRESH);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};

let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(fn: () => void) { onAuthLost = fn; }

export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 60000 });

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccess();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = await tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    // plain axios on purpose: must not go through the interceptors above
    const res = await axios.post<AuthResponse>(`${API_URL}/api/v1/auth/refresh`, { refreshToken: refresh }, { timeout: 60000 });
    await tokenStore.save(res.data.accessToken, res.data.refreshToken);
    return res.data.accessToken;
  } catch (e) {
    const status = (e as AxiosError).response?.status;
    if (status === 401 || status === 403) await tokenStore.clear(); // server rejected it: session is over
    return null;                                                    // network error: keep the session, just fail this call
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.startsWith('/auth/')) {
      original._retry = true;
      // one refresh at a time, even if many requests fail together
      refreshing = refreshing ?? doRefresh().finally(() => { refreshing = null; });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      if (!(await tokenStore.getRefresh())) onAuthLost?.();
    }
    return Promise.reject(error);
  },
);

export function errorMessage(e: unknown): string {
  const ax = e as AxiosError<{ message?: string }>;
  if (ax?.response?.data?.message) return ax.response.data.message;
  if (ax?.code === 'ECONNABORTED' || ax?.message === 'Network Error') {
    return 'Cannot reach the server. Check your internet connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function errorCode(e: unknown): string | undefined {
  return (e as AxiosError<{ code?: string }>)?.response?.data?.code;
}

export function errorStatus(e: unknown): number | undefined {
  return (e as AxiosError)?.response?.status;
}
