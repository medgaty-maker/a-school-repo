'use client';

import { Suspense } from 'react';
import { Calendar, Filter, Menu } from 'lucide-react';
import { UserMenu } from './user-menu';
import { LastSyncIndicator } from './last-sync-indicator';
import { ThemeSwitch } from './theme-switch';
import { useUiStore } from '@/lib/ui-store';
import { usePeriod, PERIODS } from '@/lib/use-period';

export function FilterBar() {
  const { toggleSidebar } = useUiStore();

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 border-b border-border bg-background">
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 hover:bg-muted rounded-md text-muted-foreground"
        aria-label="Открыть меню"
      >
        <Menu className="size-5" />
      </button>

      <Calendar className="size-4 text-muted-foreground hidden sm:block" />
      <Suspense fallback={<PeriodFallback />}>
        <PeriodSelector />
      </Suspense>

      <div className="text-xs text-muted-foreground items-center gap-1 hidden xl:flex">
        <Filter className="size-3" />
        фильтры по проектам — Этап 3
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden md:block">
          <LastSyncIndicator />
        </div>
        <ThemeSwitch />
        <div className="w-px h-6 bg-border hidden sm:block" />
        <UserMenu />
      </div>
    </div>
  );
}

function PeriodSelector() {
  const { period, setPeriod } = usePeriod();
  return (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value as typeof period)}
      className="text-sm bg-muted px-2 py-1 rounded-md border border-border"
    >
      {PERIODS.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}

function PeriodFallback() {
  return (
    <select disabled className="text-sm bg-muted px-2 py-1 rounded-md border border-border opacity-60">
      <option>30 дней</option>
    </select>
  );
}
