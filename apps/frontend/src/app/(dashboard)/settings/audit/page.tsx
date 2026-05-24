'use client';

import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type AuditEntry = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { email: string; name: string } | null;
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function refresh() {
    const token = readCookie('access_token');
    if (!token) return;
    setLoading(true);
    apiFetch<AuditEntry[]>('/audit-log?limit=200', { token })
      .then((data) => {
        setEntries(data);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Аудит-лог</h1>
          <p className="text-sm text-muted-foreground">
            Все мутации в системе (§16 ТЗ): кто и что изменял. Логируется автоматически.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </button>
      </header>

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
      )}

      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 w-44">Время</th>
              <th className="text-left px-3 py-2">Пользователь</th>
              <th className="text-left px-3 py-2">Действие</th>
              <th className="text-left px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries === null ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-8">
                  <ScrollText className="size-5 mx-auto mb-2" />
                  Загрузка…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-8">
                  Записей пока нет — выполните любое действие (создание пользователя,
                  подключение интеграции и т. д.).
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                    {new Date(e.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-2">
                    {e.user ? (
                      <>
                        <div className="font-medium text-sm">{e.user.name}</div>
                        <div className="text-xs text-muted-foreground">{e.user.email}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">аноним</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">{e.action}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.ip ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
