export const GLOBAL_API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api');

const TOKEN_KEY = 'bayan-global-token';
const COOKIE = 'bayan_global';

export function getGlobalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setGlobalToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = token
    ? `${COOKIE}=1; path=/; samesite=lax; max-age=2592000`
    : `${COOKIE}=; path=/; max-age=0`;
}

/** استدعاء API برمز المشرف العام. */
export async function globalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getGlobalToken();
  if (token && typeof window !== 'undefined') {
    document.cookie = `${COOKIE}=1; path=/; samesite=lax; max-age=2592000`;
  }
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${GLOBAL_API}${path}`, { ...init, headers });
  if (res.status === 401) {
    setGlobalToken(null);
    window.location.replace('/global/login');
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = String(body.message);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}