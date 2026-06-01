'use client';

import { Menu } from 'lucide-react';
import { UserMenu } from './user-menu';
import { LastSyncIndicator } from './last-sync-indicator';
import { ThemeSwitch } from './theme-switch';
import { useUiStore } from '@/lib/ui-store';

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
