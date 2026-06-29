import { ReactNode } from 'react';
import { cn, formatNumber } from '@/lib/utils';

export type KpiCardProps = {
  label: string;
  value: number | string | null;
  unit?: string;
  hint?: string;
  trend?: { delta: number; direction: 'up' | 'down' | 'flat' };
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  icon?: ReactNode;
  pending?: boolean; // данные не подтянуты — заглушка
  pendingNote?: string; // объяснение, в каком этапе появятся данные
};

const STATUS_CLASSES: Record<NonNullable<KpiCardProps['status']>, string> = {
  good: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  bad: 'bg-danger/10 text-danger',
  neutral: 'bg-muted text-muted-foreground',
};

export function KpiCard({
  label, value, unit, hint, trend, status = 'neutral', icon, pending, pendingNote,
}: KpiCardProps) {
  return (
    <div className="h-full border border-border rounded-xl p-5 bg-background flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>

      <div className="flex items-baseline gap-2">
        {pending ? (
          <div className="text-2xl font-bold text-muted-foreground">—</div>
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">
              {typeof value === 'number' ? formatNumber(value) : value ?? '—'}
            </div>
            {unit ? <div className="text-sm text-muted-foreground">{unit}</div> : null}
          </>
        )}
      </div>

      {trend && !pending ? (
        <div className={cn('inline-flex w-fit items-center gap-1 text-xs px-2 py-0.5 rounded-md', STATUS_CLASSES[status])}>
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '·'}
          <span>{Math.abs(trend.delta)}%</span>
        </div>
      ) : null}

      {hint && !pending ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}

      {pending && pendingNote ? (
        <div className="text-xs text-muted-foreground italic mt-1">{pendingNote}</div>
      ) : null}
    </div>
  );
}
