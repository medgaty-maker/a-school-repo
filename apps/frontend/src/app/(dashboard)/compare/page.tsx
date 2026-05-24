'use client';

import { useEffect, useState, Suspense } from 'react';
import { Download, Trophy, Users, Eye, Clock, BarChart2 } from 'lucide-react';
import { ComparisonBar } from '@/components/widgets/comparison-bar';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';
import { usePeriod, PERIODS } from '@/lib/use-period';

type Project = { id: string; slug: string; name: string; platforms: { platform: string; status: string }[] };

type ProjectMetrics = {
  project: { slug: string; name: string };
  platforms: Record<string, { metrics: Record<string, number>; status: string }>;
};

type ProjectRow = {
  slug: string;
  name: string;
  ytStatus: string;
  metrics: Record<string, number>;
};

const TABLE_METRICS: { key: string; label: string; format: (v: number) => string }[] = [
  { key: 'subscribers_total', label: 'Подписчики', format: formatNumber },
  { key: 'views_28d', label: 'Просмотры (28д)', format: formatNumber },
  { key: 'views_total', label: 'Просмотры (всего)', format: formatNumber },
  { key: 'videos_total', label: 'Видео', format: (v) => String(v) },
  { key: 'avg_view_percentage_28d', label: 'Удержание', format: (v) => `${v.toFixed(1)}%` },
  { key: 'estimated_minutes_watched_28d', label: 'Время просмотра (мин)', format: formatNumber },
  { key: 'likes_28d', label: 'Лайки (28д)', format: formatNumber },
  { key: 'comments_28d', label: 'Комментарии (28д)', format: formatNumber },
];

function CompareContent() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { period, setPeriod } = usePeriod();

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    setLoading(true);

    (async () => {
      try {
        const list = await apiFetch<Project[]>('/projects', { token });
        const settled = await Promise.allSettled(
          list.map((p) =>
            apiFetch<ProjectMetrics>(`/projects/${p.slug}/metrics?period=${period}`, { token }),
          ),
        );
        const built: ProjectRow[] = list.map((p, i) => {
          const res = settled[i];
          const m: ProjectMetrics | null = res.status === 'fulfilled' ? res.value : null;
          return {
            slug: p.slug,
            name: p.name,
            ytStatus: m?.platforms.YOUTUBE?.status ?? 'NOT_CONNECTED',
            metrics: m?.platforms.YOUTUBE?.metrics ?? {},
          };
        });
        setRows(built);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  function exportCSV() {
    const headers = ['Проект', ...TABLE_METRICS.map((m) => m.label)];
    const data = rows.map((r) => [r.name, ...TABLE_METRICS.map((m) => r.metrics[m.key] ?? '')]);
    const csv = [headers, ...data].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `сравнение-${period}.csv`;
    a.click();
  }

  const maxValues: Record<string, number> = {};
  for (const { key } of TABLE_METRICS) {
    maxValues[key] = Math.max(...rows.map((r) => r.metrics[key] ?? 0));
  }

  const sortedBy = (key: string) =>
    [...rows]
      .map((r) => ({ name: r.name, slug: r.slug, value: r.metrics[key] ?? 0 }))
      .sort((a, b) => b.value - a.value);

  const leader = (key: string) =>
    rows.reduce<ProjectRow | null>(
      (best, r) => (!best || (r.metrics[key] ?? 0) > (best.metrics[key] ?? 0) ? r : best),
      null,
    );

  const connectedCount = rows.filter((r) => r.ytStatus === 'ACTIVE').length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Сравнение проектов</h1>
          <p className="text-sm text-muted-foreground">
            YouTube-метрики по всем {rows.length} проектам ·{' '}
            {connectedCount > 0 ? `${connectedCount} из ${rows.length} подключены` : 'нет данных'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            className="text-sm bg-muted px-3 py-1.5 rounded-md border border-border"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="size-4" /> CSV
          </button>
        </div>
      </header>

      {!loading && connectedCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LeaderCard
            icon={<Users className="size-4" />}
            label="Лидер по подписчикам"
            project={leader('subscribers_total')}
            metricKey="subscribers_total"
            format={formatNumber}
          />
          <LeaderCard
            icon={<Eye className="size-4" />}
            label="Лидер по просмотрам (28д)"
            project={leader('views_28d')}
            metricKey="views_28d"
            format={formatNumber}
          />
          <LeaderCard
            icon={<Clock className="size-4" />}
            label="Лучшее удержание"
            project={leader('avg_view_percentage_28d')}
            metricKey="avg_view_percentage_28d"
            format={(v) => `${v.toFixed(1)}%`}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border rounded-xl p-5 h-[280px] bg-muted/10 animate-pulse" />
          ))}
        </div>
      ) : connectedCount === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center text-muted-foreground">
          <BarChart2 className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Нет данных для сравнения</p>
          <p className="text-sm mt-1">
            Подключите YouTube-каналы в{' '}
            <a href="/settings" className="underline text-primary">Настройках</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonBar
              title="Подписчики"
              metricLabel="Подписчики"
              data={sortedBy('subscribers_total')}
              height={240}
            />
            <ComparisonBar
              title="Просмотры (28 дней)"
              metricLabel="Просмотры"
              data={sortedBy('views_28d')}
              height={240}
            />
            <ComparisonBar
              title="Время просмотра (мин, 28 дней)"
              metricLabel="Минут"
              data={sortedBy('estimated_minutes_watched_28d')}
              height={240}
            />
            <ComparisonBar
              title="Удержание аудитории (%)"
              metricLabel="Удержание %"
              data={sortedBy('avg_view_percentage_28d')}
              height={240}
            />
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-background">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Детальная таблица</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Зелёный — лучший показатель по строке</p>
              </div>
              <Trophy className="size-4 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-3 sticky left-0 bg-background z-10 min-w-[130px]">Метрика</th>
                    {rows.map((r) => (
                      <th key={r.slug} className="text-right p-3 min-w-[110px] font-medium text-foreground">
                        <div>{r.name}</div>
                        {r.ytStatus !== 'ACTIVE' && (
                          <div className="text-[10px] text-muted-foreground font-normal">не подключён</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_METRICS.map(({ key, label, format }) => {
                    const max = maxValues[key];
                    return (
                      <tr key={key} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="p-3 text-muted-foreground text-xs sticky left-0 bg-background">{label}</td>
                        {rows.map((r) => {
                          const val = r.metrics[key] ?? 0;
                          const isBest = val > 0 && val === max;
                          return (
                            <td
                              key={r.slug}
                              className={`p-3 text-right tabular-nums text-xs ${
                                isBest
                                  ? 'bg-success/10 text-success font-semibold'
                                  : val === 0
                                  ? 'text-muted-foreground'
                                  : ''
                              }`}
                            >
                              {val > 0 ? format(val) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareContent />
    </Suspense>
  );
}

function LeaderCard({
  icon,
  label,
  project,
  metricKey,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  project: ProjectRow | null;
  metricKey: string;
  format: (v: number) => string;
}) {
  const val = project?.metrics[metricKey] ?? 0;
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs">
        {icon}
        {label}
      </div>
      <div className="font-semibold">{project?.name ?? '—'}</div>
      <div className="text-2xl font-bold tabular-nums text-primary mt-1">
        {val > 0 ? format(val) : '—'}
      </div>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
