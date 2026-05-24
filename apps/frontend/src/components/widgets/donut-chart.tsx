'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatNumber } from '@/lib/utils';

type Slice = { name: string; value: number };
type Props = { title?: string; data: Slice[]; height?: number; emptyMessage?: string };

const PALETTE = [
  'hsl(221 83% 53%)',
  'hsl(0 84% 60%)',
  'hsl(38 92% 50%)',
  'hsl(142 71% 45%)',
  'hsl(262 83% 58%)',
  'hsl(173 80% 40%)',
  'hsl(330 81% 60%)',
];

export function DonutChart({ title, data, height = 240, emptyMessage }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const isEmpty = total === 0 || data.length === 0;

  return (
    <div className="border border-border rounded-xl bg-background p-5 h-full">
      {title && <div className="font-semibold mb-3">{title}</div>}
      {isEmpty ? (
        <div className="h-[200px] grid place-items-center text-sm text-muted-foreground text-center px-4">
          {emptyMessage ?? 'Нет данных'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name) => [
                `${formatNumber(v)} (${((v / total) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => value.replace(/_/g, ' ').toLowerCase()}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
