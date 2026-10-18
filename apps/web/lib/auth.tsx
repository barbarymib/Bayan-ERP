'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, clearToken, getToken, request, setRefreshToken, setToken, syncAuthCookie, type AuthUser } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  features: Record<string, boolean>;
  featureEnabled: (code: string) => boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = getToken();
      if (!token) {
        clearToken();
        if (!cancelled) setLoading(false);
        return;
      }
      syncAuthCookie();
      try {
        const me = await request<AuthUser>('/auth/me');
        if (!cancelled) setUser(me);
        try {
          const flags = await request<Record<string, boolean>>('/auth/features');
          if (!cancelled) setFeatures(flags);
        } catch {
          /* features are optional; default to visible */
        }
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const body: Record<string, string> = { password };
    if (identifier.includes('@')) body.email = identifier;
    else body.phone = identifier;
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = 'بيانات الدخول غير صحيحة';
      try {
        const data = (await res.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    };
    setToken(data.accessToken);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setUser(data.user);
    try {
      const flags = await request<Record<string, boolean>>('/auth/features');
      setFeatures(flags);
    } catch {
      setFeatures({});
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setFeatures({});
  }, []);

  const featureEnabled = useCallback((code: string) => features[code] !== false, [features]);

  const value = useMemo(
    () => ({ user, loading, features, featureEnabled, login, logout }),
    [user, loading, features, featureEnabled, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 font-semibold">
        جارِ التحميل…
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}