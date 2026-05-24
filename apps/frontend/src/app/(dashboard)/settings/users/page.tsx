'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Plus, Trash2, ShieldCheck, Power } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const ROLES = [
  { value: 'DIRECTOR', label: 'Директор школы' },
  { value: 'MARKETING_DIRECTOR', label: 'Директор по маркетингу' },
  { value: 'SMM', label: 'SMM-специалист' },
  { value: 'TARGETOLOG', label: 'Таргетолог' },
  { value: 'SALES', label: 'Отдел продаж' },
  { value: 'ADMIN', label: 'Администратор' },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Create form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SMM');

  function refresh() {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<User[]>('/users', { token })
      .then(setUsers)
      .catch((e) => setError((e as Error).message));
  }

  useEffect(refresh, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    const token = readCookie('access_token');
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        token,
        body: JSON.stringify({ email, name, password, role }),
      });
      setShowForm(false);
      setEmail(''); setName(''); setPassword(''); setRole('SMM');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: User) {
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function changeRole(user: User, newRole: string) {
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ role: newRole }),
      });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteUser(user: User) {
    if (!confirm(`Удалить пользователя ${user.email}?`)) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE', token });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Пользователи и права</h1>
          <p className="text-sm text-muted-foreground">
            6 ролей из ТЗ §16. Каждая роль определяет, какие разделы доступны.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="size-4" /> Добавить
        </button>
      </header>

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={createUser}
          className="border border-border rounded-xl bg-background p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Имя</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Пароль (мин. 6)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-md text-sm bg-background"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-md text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              {busy ? 'Создаю…' : 'Создать'}
            </button>
          </div>
        </form>
      )}

      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Имя / Email</th>
              <th className="text-left px-3 py-2">Роль</th>
              <th className="text-center px-3 py-2">Статус</th>
              <th className="text-right px-3 py-2">Создан</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users === null ? (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-6">
                  Загрузка…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground py-6">
                  Пользователей нет
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="text-xs px-2 py-1 border border-border rounded bg-background"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-center px-3 py-2">
                    {u.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-success/10 text-success">
                        Активен
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        Заблокирован
                      </span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => toggleActive(u)}
                        className="p-1.5 hover:bg-muted rounded"
                        title={u.isActive ? 'Заблокировать' : 'Разблокировать'}
                      >
                        <Power className="size-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="p-1.5 hover:bg-danger/10 hover:text-danger rounded text-muted-foreground"
                        title="Удалить"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="border border-border rounded-xl bg-background p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <div className="font-semibold">Что видит каждая роль</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {ROLES.map((r) => (
            <div key={r.value} className="border border-border rounded-md p-3">
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {ACCESS_HINTS[r.value]}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const ACCESS_HINTS: Record<string, string> = {
  DIRECTOR: 'Главный экран «Обзор», сравнения, отчёты. Read-only.',
  MARKETING_DIRECTOR: 'Полный доступ ко всем разделам и фильтрам. Можно подключать API.',
  SMM: 'Свои проекты — read-only по контентным метрикам YouTube/Instagram/Facebook/TikTok.',
  TARGETOLOG: 'Раздел «Реклама (Meta Ads)» по своим кабинетам. Read-only.',
  SALES: 'Раздел «Лиды и продажи», воронка Bitrix24. Read-only.',
  ADMIN: 'Полный доступ + управление пользователями + аудит-лог.',
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
