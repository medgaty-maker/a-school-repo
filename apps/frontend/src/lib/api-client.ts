const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type FetchOptions = RequestInit & { token?: string };

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = typeof localStorage !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!rt) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) throw new Error('refresh failed');
    const data: { accessToken: string; refreshToken: string } = await res.json();
    document.cookie = `access_token=${data.accessToken}; path=/; max-age=604800; samesite=lax`;
    localStorage.setItem('refresh_token', data.refreshToken);
    return data.accessToken;
  } catch {
    document.cookie = 'access_token=; path=/; max-age=0; samesite=lax';
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('ngrok-skip-browser-warning', 'true');
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);

  const res = await fetch(`${API_BASE}/api${path}`, { ...opts, headers, cache: 'no-store' });

  if (res.status === 401 && opts.token) {
    // Deduplicate concurrent refresh calls
    if (!refreshing) refreshing = tryRefresh().finally(() => { refreshing = null; });
    const newToken = await refreshing;
    if (!newToken) throw new Error('Сессия истекла');

    const retryHeaders = new Headers(opts.headers);
    retryHeaders.set('Content-Type', 'application/json');
    retryHeaders.set('ngrok-skip-browser-warning', 'true');
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    const retry = await fetch(`${API_BASE}/api${path}`, { ...opts, headers: retryHeaders, cache: 'no-store' });
    if (!retry.ok) {
      const text = await retry.text().catch(() => '');
      throw new Error(`API ${retry.status}: ${text || retry.statusText}`);
    }
    if (retry.status === 204) return undefined as T;
    return (await retry.json()) as T;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(email: string, password: string) {
  return apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; role: string };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
