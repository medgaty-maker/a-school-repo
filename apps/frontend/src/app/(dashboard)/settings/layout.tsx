'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Plug, Users, ScrollText, Target, Link2, AlertTriangle } from 'lucide-react';

const TABS = [
  { href: '/settings', label: 'Подключения', icon: Plug, exact: true },
  { href: '/settings/users', label: 'Пользователи', icon: Users },
  { href: '/settings/audit', label: 'Аудит-лог', icon: ScrollText },
  { href: '/settings/goals', label: 'Цели и алерты', icon: Target, todo: '§14.4 — Этап 6' },
  { href: '/utm', label: 'UTM-конструктор', icon: Link2 },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-border bg-background py-4 px-3 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground px-2 mb-2 uppercase tracking-wide">
          Настройки
        </div>
        <nav className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(tab.href + '/');
            const disabled = !!tab.todo;

            if (disabled) {
              return (
                <div
                  key={tab.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/70 cursor-not-allowed"
                  title={tab.todo}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{tab.label}</span>
                  <AlertTriangle className="size-3" />
                </div>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 px-2 text-xs text-muted-foreground space-y-1">
          <div>Доступ к разделу</div>
          <div className="text-[11px] leading-relaxed">
            Подключения и пользователи — только ADMIN. Аудит — ADMIN. Остальное по ролям ТЗ §16.
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
