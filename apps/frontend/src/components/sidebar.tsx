'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/ui-store';
import {
  LayoutDashboard, Film, Megaphone, Target, Globe, MessageCircle,
  Link2, BarChart3, FileDown, Settings, X,
} from 'lucide-react';

// 11 разделов — ТЗ §5.1
const NAV = [
  { href: '/overview', label: 'Обзор', icon: LayoutDashboard },
  { href: '/projects', label: 'Проекты', icon: Film },
  { href: '/ads', label: 'Реклама (Meta Ads)', icon: Megaphone },
  { href: '/leads', label: 'Лиды и продажи', icon: Target },
  { href: '/traffic', label: 'Трафик сайтов', icon: Globe },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/utm', label: 'UTM-трекер', icon: Link2 },
  { href: '/compare', label: 'Сравнение', icon: BarChart3 },
  { href: '/reports', label: 'Отчёты', icon: FileDown },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, closeSidebar } = useUiStore();

  return (
    <>
      {/* Backdrop на мобиле */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 z-40 w-64 shrink-0 border-r border-border bg-background h-screen flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="px-5 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div className="font-bold text-lg leading-tight">Malenia</div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 hover:bg-muted rounded-md text-muted-foreground"
            aria-label="Закрыть меню"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          v0.2 · MVP
        </div>
      </aside>
    </>
  );
}
