'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { applyTheme } from './theme-provider';

type Theme = 'light' | 'dark' | 'system';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme | null) ?? 'system';
    setTheme(stored);
  }, []);

  function set(next: Theme) {
    setTheme(next);
    if (next === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', next);
    applyTheme();
  }

  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden">
      <ThemeButton active={theme === 'light'} onClick={() => set('light')} title="Светлая">
        <Sun className="size-3.5" />
      </ThemeButton>
      <ThemeButton active={theme === 'system'} onClick={() => set('system')} title="Системная">
        <Monitor className="size-3.5" />
      </ThemeButton>
      <ThemeButton active={theme === 'dark'} onClick={() => set('dark')} title="Темная">
        <Moon className="size-3.5" />
      </ThemeButton>
    </div>
  );
}

function ThemeButton({
  active, onClick, title, children,
}: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 ${active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted text-muted-foreground'}`}
    >
      {children}
    </button>
  );
}
