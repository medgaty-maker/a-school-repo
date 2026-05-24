'use client';

import { formatNumber } from '@/lib/utils';

type DailyPoint = { day: string; views: number };
type Props = {
  title?: string;
  daily: DailyPoint[];
  emptyMessage?: string;
};

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/**
 * §6.6 / §7.2 — heatmap активности по дням недели.
 * YouTube Analytics не отдаёт почасовую детализацию — агрегируем по дням недели за 28 дней.
 */
export function WeekdayHeatmap({ title, daily, emptyMessage }: Props) {
  const isEmpty = !daily || daily.length === 0 || daily.every((d) => d.views === 0);

  // Группируем по дню недели (0=Sun…6=Sat)
  const byWeekday: number[] = Array(7).fill(0);
  const counts: number[] = Array(7).fill(0);
  for (const p of daily ?? []) {
    const d = new Date(p.day + 'T00:00:00Z');
    const w = d.getUTCDay();
    byWeekday[w] += p.views;
    counts[w]++;
  }
  const avg = byWeekday.map((v, i) => (counts[i] ? v / counts[i] : 0));
  const max = Math.max(...avg, 1);

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {isEmpty ? (
        <div className="h-[120px] grid place-items-center text-sm text-muted-foreground text-center">
          {emptyMessage ?? 'График активности появится после первого синка'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((label, i) => {
              const intensity = avg[i] / max;
              return (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div
                    className="w-full aspect-square rounded-md grid place-items-center text-xs font-medium transition"
                    style={{
                      backgroundColor: `hsl(221 83% ${Math.max(35, 95 - intensity * 60)}%)`,
                      color: intensity > 0.4 ? 'white' : 'hsl(222 47% 11%)',
                    }}
                    title={`${label}: ${formatNumber(avg[i])} avg/день`}
                  >
                    {formatNumber(Math.round(avg[i]))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Средние просмотры по дню недели за 28 дней. Помогает планировать публикации.
          </div>
        </>
      )}
    </div>
  );
}
