'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, UserIcon, Shield, ChevronDown } from 'lucide-react';

type StoredUser = { id: string; email: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: 'Директор школы',
  MARKETING_DIRECTOR: 'Директор по маркетингу',
  SMM: 'SMM',
  TARGETOLOG: 'Таргетолог',
  SALES: 'Отдел продаж',
  ADMIN: 'Администратор',
};

export function UserMenu() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function logout() {
    document.cookie = 'access_token=; path=/; max-age=0; samesite=lax';
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition"
      >
        <div className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
          {initials || 'U'}
        </div>
        <div className="text-sm font-medium hidden md:block">{user.name}</div>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-primary">
              <Shield className="size-3" />
              {ROLE_LABEL[user.role] ?? user.role}
            </div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition"
          >
            <UserIcon className="size-4" /> Профиль
          </Link>
          <div className="my-1 border-t border-border" />
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/5 transition"
          >
            <LogOut className="size-4" /> Выйти
          </button>
        </div>
      )}
    </div>
  );
}
