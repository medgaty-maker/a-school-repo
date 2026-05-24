'use client';

import { formatNumber } from '@/lib/utils';

type Item = { country: string; views: number };
type Props = { title?: string; data: Item[]; emptyMessage?: string };

// Минимальный маппинг кодов в флаги/названия
const COUNTRIES: Record<string, { flag: string; name: string }> = {
  KZ: { flag: '🇰🇿', name: 'Казахстан' },
  KG: { flag: '🇰🇬', name: 'Кыргызстан' },
  UZ: { flag: '🇺🇿', name: 'Узбекистан' },
  RU: { flag: '🇷🇺', name: 'Россия' },
  UA: { flag: '🇺🇦', name: 'Украина' },
  BY: { flag: '🇧🇾', name: 'Беларусь' },
  TJ: { flag: '🇹🇯', name: 'Таджикистан' },
  TM: { flag: '🇹🇲', name: 'Туркменистан' },
  AZ: { flag: '🇦🇿', name: 'Азербайджан' },
  AM: { flag: '🇦🇲', name: 'Армения' },
  GE: { flag: '🇬🇪', name: 'Грузия' },
  TR: { flag: '🇹🇷', name: 'Турция' },
  US: { flag: '🇺🇸', name: 'США' },
  DE: { flag: '🇩🇪', name: 'Германия' },
  MN: { flag: '🇲🇳', name: 'Монголия' },
  CN: { flag: '🇨🇳', name: 'Китай' },
};

export function CountriesList({ title, data, emptyMessage }: Props) {
  const max = Math.max(...(data ?? []).map((d) => d.views), 1);
  const isEmpty = !data || data.length === 0;

  return (
    <div className="border border-border rounded-xl bg-background p-5 h-full">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {isEmpty ? (
        <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
          {emptyMessage ?? 'Нет данных'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 10).map((c) => {
            const info = COUNTRIES[c.country] ?? { flag: '🌐', name: c.country };
            const w = (c.views / max) * 100;
            return (
              <div key={c.country} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-base leading-none">{info.flag}</span>
                <span className="w-24 text-xs truncate">{info.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${w}%` }} />
                </div>
                <span className="w-16 text-right text-xs tabular-nums">
                  {formatNumber(c.views)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
