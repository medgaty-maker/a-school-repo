'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
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

export function TrendChart({ title, series, height = 280, emptyMessage }: Props) {
  const allEmpty = series.every((s) => s.data.length === 0);

  // Сводим в общий формат для Recharts
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.x))),
  ).sort();

  const merged = allDates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of series) {
      const point = s.data.find((d) => d.x === date);
      if (point) row[s.name] = point.y;
    }
    return row;
  });

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {allEmpty ? (
        <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
          {emptyMessage ?? 'Нет данных за выбранный период'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={merged} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v as number)} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleDateString('ru-RU')}
              formatter={(value: number) => formatNumber(value)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
