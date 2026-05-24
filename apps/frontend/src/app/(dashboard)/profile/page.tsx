'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Shield, KeyRound, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: 'Директор школы',
  MARKETING_DIRECTOR: 'Директор по маркетингу',
  SMM: 'SMM',
  TARGETOLOG: 'Таргетолог',
  SALES: 'Отдел продаж',
  ADMIN: 'Администратор',
};

type Me = { id: string; email: string; name: string; role: string };

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<Me>('/users/me', { token })
      .then((u) => { setMe(u); setName(u.name); })
      .catch(console.error);
  }, []);

  async function save() {
    const token = readCookie('access_token');
    if (!token || !me) return;

    if (newPassword && newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Новые пароли не совпадают' });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== me.name) body.name = name.trim();
      if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }

      if (Object.keys(body).length === 0) {
        setStatus({ type: 'error', msg: 'Нет изменений для сохранения' });
        return;
      }

      const updated = await apiFetch<Me>('/users/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      });

      setMe(updated);
      setName(updated.name);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // обновить имя в localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('user') ?? '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, name: updated.name }));
      } catch {}

      setStatus({ type: 'success', msg: 'Изменения сохранены' });
    } catch (e: any) {
      const msg = e?.message?.includes('401') || e?.message?.includes('Неверный')
        ? 'Неверный текущий пароль'
        : e?.message ?? 'Ошибка сохранения';
      setStatus({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }

  if (!me) {
    return <div className="p-6 text-muted-foreground text-sm">Загрузка…</div>;
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Профиль</h1>
        <p className="text-sm text-muted-foreground">Имя и пароль вашей учётной записи</p>
      </header>

      {/* Роль */}
      <div className="border border-border rounded-xl p-4 bg-background flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
          {me.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <div className="font-medium">{me.name}</div>
          <div className="text-xs text-muted-foreground">{me.email}</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
            <Shield className="size-3" />
            {ROLE_LABEL[me.role] ?? me.role}
          </div>
        </div>
      </div>

      {/* Имя */}
      <section className="border border-border rounded-xl p-5 bg-background space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <User className="size-4" /> Отображаемое имя
        </h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </section>

      {/* Пароль */}
      <section className="border border-border rounded-xl p-5 bg-background space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound className="size-4" /> Смена пароля
        </h2>
        <p className="text-xs text-muted-foreground">Оставьте пустым, если не хотите менять пароль</p>
        <input
          type="password"
          placeholder="Текущий пароль"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          placeholder="Новый пароль (минимум 6 символов)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          placeholder="Повторите новый пароль"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </section>

      {/* Статус */}
      {status && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
          status.type === 'success'
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'
        }`}>
          {status.type === 'success'
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <AlertCircle className="size-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-60 hover:opacity-90 transition"
      >
        <Save className="size-4" />
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
