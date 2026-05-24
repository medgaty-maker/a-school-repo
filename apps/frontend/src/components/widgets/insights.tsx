'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, AlertTriangle, AlertOctagon, Info, Lightbulb, TrendingUp, TrendingDown,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Insight = {
  id: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  category: 'sync' | 'growth' | 'engagement' | 'audience';
  title: string;
  description: string;
  projectSlug?: string;
  projectName?: string;
  platform?: string;
  detectedAt: string;
};

const SEVERITY_STYLES: Record<Insight['severity'], { bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  danger: { bg: 'bg-danger/5', border: 'border-danger/30', icon: AlertOctagon },
  warning: { bg: 'bg-warning/5', border: 'border-warning/30', icon: AlertTriangle },
  success: { bg: 'bg-success/5', border: 'border-success/30', icon: CheckCircle2 },
  info: { bg: 'bg-primary/5', border: 'border-primary/30', icon: Info },
};

const SEVERITY_ICON_COLOR: Record<Insight['severity'], string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-primary',
};

type Props = { token: string | null };

export function InsightsBlock({ token }: Props) {
  const [insights, setInsights] = useState<Insight[] | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<Insight[]>('/insights', { token }).then(setInsights).catch(console.error);
  }, [token]);

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="size-4 text-warning" />
        <div className="font-semibold">Инсайты и алерты</div>
        <div className="ml-auto text-xs text-muted-foreground">
          Автоматический анализ. Полные настраиваемые правила — Этап 6.
        </div>
      </div>

      {insights === null ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Загрузка…</div>
      ) : insights.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Пока нет инсайтов. Запустите синхронизацию в «Настройках».
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((i) => {
            const s = SEVERITY_STYLES[i.severity];
            const Icon = s.icon;
            const Trend =
              i.title.includes('Рост') ? TrendingUp :
              i.title.includes('падение') || i.title.includes('Снижение') ? TrendingDown :
              null;
            return (
              <div
                key={i.id}
                className={cn('border rounded-lg p-3 flex gap-3', s.bg, s.border)}
              >
                <Icon className={cn('size-5 shrink-0 mt-0.5', SEVERITY_ICON_COLOR[i.severity])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{i.title}</span>
                    {Trend && <Trend className={cn('size-3.5', SEVERITY_ICON_COLOR[i.severity])} />}
                    {i.projectSlug && (
                      <Link
                        href={`/projects/${i.projectSlug}`}
                        className="text-xs px-1.5 py-0.5 rounded bg-background/60 border border-border hover:bg-background"
                      >
                        {i.projectName} → {i.platform}
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{i.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
