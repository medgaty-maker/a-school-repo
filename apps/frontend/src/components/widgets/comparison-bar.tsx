'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useRouter } from 'next/navigation';
import { formatNumber } from '@/lib/utils';

type Item = { name: string; value: number; slug?: string };

type Props = {
  title?: string;
  metricLabel: string;
  data: Item[];
  height?: number;
};

const PALETTE = [
  'hsl(221 83% 53%)',
  'hsl(262 83% 58%)',
  'hsl(173 80% 40%)',
  'hsl(38 92% 50%)',
  'hsl(0 84% 60%)',
  'hsl(142 71% 45%)',
];

export function ComparisonBar({ title, metricLabel, data, height = 280 }: Props) {
  const router = useRouter();
  const allZero = data.every((d) => d.value === 0);

  function onBarClick(item: Item) {
    if (item.slug) router.push(`/projects/${item.slug}`);
  }

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">{title}</div>
          {!allZero && data.some((d) => d.slug) && (
            <div className="text-xs text-muted-foreground">кликните на бар → проект</div>
          )}
        </div>
      )}
      {allZero ? (
        <div className="h-[200px] grid place-items-center text-sm text-muted-foreground text-center px-4">
          Сравнение появится после первого синка YouTube/Meta.
          <br />
          Подключите интеграцию в «Настройках».
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v as number)} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip
              formatter={(value: number) => [formatNumber(value), metricLabel]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(_data: any, index: number) => onBarClick(data[index])}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
