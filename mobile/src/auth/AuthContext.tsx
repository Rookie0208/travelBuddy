import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthLostHandler, tokenStore } from '../api/client';
import * as endpoints from '../api/endpoints';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  user: User | null;
  booting: boolean;
  completeAuth: (res: AuthResponse) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  const clearSession = useCallback(() => { setUser(null); qc.clear(); }, [qc]);

  useEffect(() => {
    setAuthLostHandler(clearSession);
    (async () => {
      try {
        if (await tokenStore.getRefresh()) setUser(await endpoints.auth.me());   // refreshes automatically if needed
      } catch {
        // offline or expired: user will see the login screen if the session is really gone
        if (!(await tokenStore.getRefresh())) setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, [clearSession]);

  const completeAuth = useCallback(async (res: AuthResponse) => {
    await tokenStore.save(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    const refresh = await tokenStore.getRefresh();
    try { if (refresh) await endpoints.auth.logout(refresh); } catch { /* ignore: we still log out locally */ }
    await tokenStore.clear();
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ user, booting, completeAuth, updateUser, logout }), [user, booting, completeAuth, updateUser, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
