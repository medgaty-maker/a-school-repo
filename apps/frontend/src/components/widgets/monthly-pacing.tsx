'use client';

import { formatNumber } from '@/lib/utils';

export type PacingMetric = {
  key: string;
  title: string;
  points: Array<{ label: string; value: number; isCurrent: boolean }>;
  current: { value: number; prevSameDay: number; prevFull: number; pacePct: number | null; projection: number };
};
export type MonthlyPacing = { asOf: string; dayOfMonth: number; metrics: PacingMetric[] };

// Блок «Помесячно · прогноз»: 2 полных месяца + текущий с прогнозом до конца месяца.
export function MonthlyPacingBlock({
  data,
  title = 'Помесячно · прогноз',
  subtitle = '2 полных месяца и текущий (факт на сегодня) · темп — сравнение с прошлым месяцем на ту же дату',
}: {
  data: MonthlyPacing | null;
  title?: string;
  subtitle?: string;
}) {
  if (!data || data.metrics.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.metrics.map((m) => {
          const max = Math.max(...m.points.map((p) => p.value), m.current.projection, 1);
          const up = (m.current.pacePct ?? 0) >= 0;
          return (
            <div key={m.key} className="border border-border rounded-xl bg-background p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">{m.title}</span>
                {m.current.pacePct != null && (
                  <span className={`text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
                    {up ? '▲' : '▼'} {Math.abs(m.current.pacePct)}% к темпу
                  </span>
                )}
              </div>
              <div className="flex items-end gap-3 h-28">
                {m.points.map((p, i) => {
                  const h = Math.round((p.value / max) * 100);
                  const projH = p.isCurrent ? Math.round((m.current.projection / max) * 100) : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                      <div className="text-xs font-semibold tabular-nums">{formatNumber(p.value)}</div>
                      <div className="w-full relative flex items-end justify-center" style={{ height: '100%' }}>
                        {p.isCurrent && m.current.projection > p.value && (
                          <div
                            className="absolute bottom-0 w-full rounded-t bg-primary/20 border border-dashed border-primary/40"
                            style={{ height: `${projH}%` }}
                            title={`Прогноз к концу месяца: ${formatNumber(m.current.projection)}`}
                          />
                        )}
                        <div
                          className={`w-full rounded-t ${p.isCurrent ? 'bg-primary' : 'bg-primary/50'}`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground text-center leading-tight">
                        {p.label.replace(/ \d{4}$/, '')}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                Прогноз к концу месяца: <strong className="text-foreground tabular-nums">{formatNumber(m.current.projection)}</strong>
                {' '}(было в прошлом: {formatNumber(m.current.prevFull)})
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
