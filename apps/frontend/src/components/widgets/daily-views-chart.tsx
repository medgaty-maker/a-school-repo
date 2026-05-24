'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatNumber } from '@/lib/utils';

type Point = { day: string; views: number; estimatedMinutesWatched?: number };
type Props = { title?: string; daily: Point[]; height?: number; emptyMessage?: string };

export function DailyViewsChart({ title, daily, height = 220, emptyMessage }: Props) {
  const isEmpty = !daily || daily.length === 0 || daily.every((d) => d.views === 0);

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {isEmpty ? (
        <div className="h-[180px] grid place-items-center text-sm text-muted-foreground">
          {emptyMessage ?? 'Нет данных'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={daily} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v as number)} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleDateString('ru-RU')}
              formatter={(value: number) => formatNumber(value)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="hsl(221 83% 53%)"
              strokeWidth={2}
              fill="url(#viewsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
