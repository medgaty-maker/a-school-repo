'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export const PERIODS = [
  { value: 'today', label: 'Сегодня', days: 1 },
  { value: 'yesterday', label: 'Вчера', days: 1 },
  { value: '7d', label: '7 дней', days: 7 },
  { value: '30d', label: '30 дней', days: 30 },
  { value: 'quarter', label: 'Квартал', days: 90 },
  { value: 'year', label: 'Год', days: 365 },
] as const;

export type Period = (typeof PERIODS)[number]['value'];

const DEFAULT: Period = '30d';

/**
 * URL-синхронизированный период (ТЗ §5.2).
 * Сохраняется в ?period=, чтобы пользователь мог делиться ссылкой.
 */
export function usePeriod() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = params?.get('period') ?? DEFAULT;
  const period: Period = (PERIODS as readonly { value: string }[]).some((p) => p.value === raw)
    ? (raw as Period)
    : DEFAULT;

  const setPeriod = useCallback(
    (next: Period) => {
      const sp = new URLSearchParams(params?.toString());
      if (next === DEFAULT) sp.delete('period');
      else sp.set('period', next);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, params],
  );

  const days = PERIODS.find((p) => p.value === period)?.days ?? 30;

  return { period, setPeriod, days };
}
