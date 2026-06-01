'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceDot,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

type Series = {
  name: string;
  color: string;
  data: Array<{ x: string; y: number }>;
};

type Props = {
  title?: string;
  series: Series[];
  height?: number;
  emptyMessage?: string;
};

function fmtTick(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

// Безопасный формат даты: при невалидном значении возвращаем '' вместо "Invalid Date"
// (recharts может вызвать форматтер с неожиданным значением до готовности данных)
function fmtDate(v: unknown, opts: Intl.DateTimeFormatOptions): string {
  if (v == null) return '';
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', opts);
}

export function TrendChart({ title, series, height = 300, emptyMessage }: Props) {
  const nonEmpty = series.filter((s) => s.data.length > 0);
  const allEmpty = nonEmpty.length === 0;

  const allDates = Array.from(
    new Set(nonEmpty.flatMap((s) => s.data.map((d) => d.x))),
  ).sort();

  // Detect if scale difference requires dual axis (ratio > 8x)
  const maxValues = nonEmpty.map((s) => Math.max(...s.data.map((d) => d.y)));
  const globalMax = Math.max(...maxValues, 1);
  const globalMin = Math.min(...maxValues, 1);
  const needsDualAxis = nonEmpty.length >= 2 && globalMax / Math.max(globalMin, 1) > 8;

  // Sort series: largest on left axis, smallest on right
  const sortedSeries = needsDualAxis
    ? [...nonEmpty].sort((a, b) => Math.max(...b.data.map((d) => d.y)) - Math.max(...a.data.map((d) => d.y)))
    : nonEmpty;
  const leftSeries = needsDualAxis ? sortedSeries.slice(0, 1) : sortedSeries;
  const rightSeries = needsDualAxis ? sortedSeries.slice(1) : [];

  const merged = allDates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const s of nonEmpty) {
      const point = s.data.find((d) => d.x === date);
      row[s.name] = point?.y ?? null;
    }
    return row;
  });

  // Last known value for each series (for end labels)
  const lastValues: Record<string, { value: number; date: string }> = {};
  for (const s of nonEmpty) {
    if (s.data.length > 0) {
      const last = s.data[s.data.length - 1];
      lastValues[s.name] = { value: last.y, date: last.x };
    }
  }

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {title && (
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div className="font-semibold text-sm">{title}</div>
          {/* Current value badges */}
          <div className="flex gap-3 flex-wrap">
            {sortedSeries.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.name}:</span>
                <span className="font-semibold tabular-nums">
                  {lastValues[s.name] ? formatNumber(lastValues[s.name].value) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allEmpty ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: 200 }}>
          {emptyMessage ?? 'Нет данных за выбранный период'}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={merged} margin={{ top: 8, right: needsDualAxis ? 55 : 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtDate(v, { day: '2-digit', month: 'short' })}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtTick}
              />
              {needsDualAxis && rightSeries.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 'auto']}
                  tick={{ fontSize: 10, fill: rightSeries[0]?.color }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtTick}
                  width={48}
                />
              )}
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                }}
                labelFormatter={(v) => fmtDate(v, { day: '2-digit', month: 'long', year: 'numeric' })}
                formatter={(value: number, name: string) => [formatNumber(value), name]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
              />
              {leftSeries.map((s) => (
                <Line
                  key={s.name}
                  yAxisId="left"
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    // Show dot only at actual data points (non-null)
                    const val = merged[index]?.[s.name];
                    if (val == null) return <g key={`dot-${index}`} />;
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={s.color} stroke="hsl(var(--background))" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
              {rightSeries.map((s) => (
                <Line
                  key={s.name}
                  yAxisId="right"
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  dot={(props: any) => {
                    const { cx, cy, index } = props;
                    const val = merged[index]?.[s.name];
                    if (val == null) return <g key={`dot-${index}`} />;
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={s.color} stroke="hsl(var(--background))" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
