'use client';

import { useEffect } from 'react';

/**
 * Применяет тему до hydration, чтобы избежать вспышки светлого фона.
 * Скрипт встраивается в <head> через layout.
 */
export function ThemeBootstrap() {
  useEffect(() => {
    // На клиенте: следим за изменением темы во вкладке
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') applyTheme();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

export function applyTheme() {
  if (typeof document === 'undefined') return;
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
}

export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
    if (isDark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`;
