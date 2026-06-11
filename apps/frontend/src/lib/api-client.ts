const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type FetchOptions = RequestInit & { token?: string };

let refreshing: Promise<string | null> | null = null;

const TIMEOUT_MS = 20000; // таймаут одного запроса
const RETRIES = 2;        // доп. попытки при медленном/холодном бэке
const RETRY_STATUS = [500, 502, 503, 504, 524]; // временные ошибки сервера

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fetchWithTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// fetch с таймаутом и ретраями. Сетевые ошибки/таймаут ретраим всегда,
// 5xx/524 — только для GET (POST/PUT не дублируем).
async function resilientFetch(url: string, init: RequestInit): Promise<Response> {
  const isGet = (init.method ?? 'GET').toUpperCase() === 'GET';
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (isGet && RETRY_STATUS.includes(res.status) && attempt < RETRIES) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e; // сеть или таймаут (abort)
      if (attempt < RETRIES) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr ?? new Error('Сеть недоступна');
}

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

  const res = await resilientFetch(`${API_BASE}/api${path}`, { ...opts, headers, cache: 'no-store' });

  if (res.status === 401 && opts.token) {
    // Deduplicate concurrent refresh calls
    if (!refreshing) refreshing = tryRefresh().finally(() => { refreshing = null; });
    const newToken = await refreshing;
    if (!newToken) throw new Error('Сессия истекла');

    const retryHeaders = new Headers(opts.headers);
    retryHeaders.set('Content-Type', 'application/json');
    retryHeaders.set('ngrok-skip-browser-warning', 'true');
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    const retry = await resilientFetch(`${API_BASE}/api${path}`, { ...opts, headers: retryHeaders, cache: 'no-store' });
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
