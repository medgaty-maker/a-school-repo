'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Play, UserPlus, DollarSign, GraduationCap, Megaphone, ArrowRight } from 'lucide-react';
import { KpiCard } from '@/components/kpi-card';
import { TrendChart } from '@/components/widgets/trend-chart';
import { ComparisonBar } from '@/components/widgets/comparison-bar';
import { TopVideos } from '@/components/widgets/top-videos';
import { WeekdayHeatmap } from '@/components/widgets/weekday-heatmap';
import { DailyViewsChart } from '@/components/widgets/daily-views-chart';
import { InsightsBlock } from '@/components/widgets/insights';
import { apiFetch } from '@/lib/api-client';
import { usePeriod, PERIODS } from '@/lib/use-period';
import { formatNumber } from '@/lib/utils';

type ProjectWithPlatforms = {
  id: string;
  slug: string;
  name: string;
  platforms: Array<{ id: string; platform: string; status: string }>;
};

type ProjectMetrics = {
  project: { slug: string; name: string };
  platforms: Record<string, {
    metrics: Record<string, number>;
    series: Array<{ metricKey: string; value: number; capturedAt: string }>;
  }>;
};

export default function OverviewPage() {
  return (
    <Suspense>
      <OverviewContent />
    </Suspense>
  );
}

function OverviewContent() {
  const [projects, setProjects] = useState<ProjectWithPlatforms[]>([]);
  const [latestByMetric, setLatestByMetric] = useState<Record<string, number>>({});
  const [allMetrics, setAllMetrics] = useState<ProjectMetrics[]>([]);
  const [aggregateDaily, setAggregateDaily] = useState<Array<{ day: string; views: number }>>([]);
  const [token, setToken] = useState<string | null>(null);
  const [bitrixSummary, setBitrixSummary] = useState<{ total: number; won: number; conversionRate: number } | null>(null);
  const [bitrixStages, setBitrixStages] = useState<Array<{ stageId: string; stageName: string; count: number; isWon: boolean; isLost: boolean }>>([]);
  const [metaInsights, setMetaInsights] = useState<{ spend: number; cpl: number; leads: number } | null>(null);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const { period } = usePeriod();
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  useEffect(() => {
    const t = readCookie('access_token');
    setToken(t);
    if (!t) return;
    const token = t;
    // Параллельно тянем агрегат дневной активности и Bitrix
    apiFetch<Array<{ day: string; views: number }>>('/integrations/youtube/aggregate-daily', { token })
      .then(setAggregateDaily)
      .catch(console.error);
    apiFetch<{ stages: Array<{ stageId: string; stageName: string; count: number; isWon: boolean; isLost: boolean }>; summary: { total: number; won: number; conversionRate: number } }>('/bitrix/funnel', { token })
      .then((f) => { setBitrixSummary(f.summary); setBitrixStages(f.stages); })
      .catch(() => null);
    apiFetch<{ configured: boolean }>('/integrations/meta/status', { token })
      .then((s) => {
        setMetaConfigured(s.configured);
        if (s.configured) {
          apiFetch<{ spend: number; cpl: number; leads: number }>('/integrations/meta/ads/insights?datePreset=last_28d', { token })
            .then(setMetaInsights)
            .catch(() => null);
        }
      })
      .catch(() => null);

    (async () => {
      try {
        const list = await apiFetch<ProjectWithPlatforms[]>('/projects', { token });
        setProjects(list);

        // Pull metrics for each project (для трендов и сравнения)
        const all: ProjectMetrics[] = [];
        const totals: Record<string, number> = {};
        for (const p of list) {
          try {
            const m = await apiFetch<ProjectMetrics>(`/projects/${p.slug}/metrics?period=${period}`, { token });
            all.push(m);
            for (const pp of Object.values(m.platforms)) {
              for (const [k, v] of Object.entries(pp.metrics)) {
                totals[k] = (totals[k] ?? 0) + Number(v);
              }
            }
          } catch (e) {
            console.error(`metrics for ${p.slug}:`, e);
          }
        }
        setAllMetrics(all);
        setLatestByMetric(totals);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [period]);

  const youtubeViews = latestByMetric['views_28d'] ?? 0;
  const youtubeSubs = latestByMetric['subscribers_total'] ?? 0;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Обзор</h1>
        <p className="text-sm text-muted-foreground">
          Сводка по {projects.length} проектам · период: <span className="font-medium text-foreground">{periodLabel}</span>.
          Данные обновляются согласно регламенту (ТЗ §3.2).
        </p>
      </header>

      {/* Инсайты и алерты */}
      <InsightsBlock token={token} />

      {/* §6.2 — Главные KPI */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="Общий охват"
            value={null}
            pending
            pendingNote="Данные Meta + GA4 — Этап 2/5"
            icon={<Eye className="size-4" />}
          />
          <KpiCard
            label="Просмотры видео (28 дней)"
            value={youtubeViews}
            hint={youtubeSubs ? `${youtubeSubs.toLocaleString('ru-RU')} подписчиков` : 'YouTube подключён? Проверьте в «Настройках»'}
            icon={<Play className="size-4" />}
            status={youtubeViews > 0 ? 'good' : 'neutral'}
          />
          <KpiCard
            label="Лиды (Bitrix24)"
            value={bitrixSummary?.total ?? null}
            pending={bitrixSummary === null}
            pendingNote="Подключите Bitrix24 в «Настройках»"
            hint={bitrixSummary ? 'за 30 дней' : undefined}
            icon={<UserPlus className="size-4" />}
            status={bitrixSummary && bitrixSummary.total > 0 ? 'good' : 'neutral'}
          />
          <KpiCard
            label="CPL"
            value={metaInsights?.cpl ?? null}
            pending={!metaConfigured}
            pendingNote="Подключите Meta Ads в «Настройках»"
            hint={metaInsights ? `${metaInsights.leads} лидов за 28 дней` : undefined}
            icon={<DollarSign className="size-4" />}
            status={metaInsights && metaInsights.cpl > 0 ? 'good' : 'neutral'}
          />
          <KpiCard
            label="Зачислений (выиграно)"
            value={bitrixSummary?.won ?? null}
            pending={bitrixSummary === null}
            pendingNote="Подключите Bitrix24 в «Настройках»"
            hint={bitrixSummary ? `конверсия ${bitrixSummary.total > 0 ? Math.round((bitrixSummary.won / bitrixSummary.total) * 100) : 0}%` : undefined}
            icon={<GraduationCap className="size-4" />}
            status={bitrixSummary && bitrixSummary.won > 0 ? 'good' : 'neutral'}
          />
          <KpiCard
            label="Расход на рекламу"
            value={metaInsights?.spend ?? null}
            pending={!metaConfigured}
            pendingNote="Подключите Meta Ads в «Настройках»"
            hint={metaInsights ? 'за 28 дней' : undefined}
            icon={<Megaphone className="size-4" />}
            status={metaInsights && metaInsights.spend > 0 ? 'good' : 'neutral'}
          />
        </div>
      </section>

      {/* §6.3 — Тренды */}
      <section>
        <TrendChart
          title="Тренды — просмотры YouTube по проектам (30 дней)"
          series={allMetrics
            .filter((m) => (m.platforms.YOUTUBE?.series ?? []).length > 0)
            .slice(0, 5)
            .map((m, i) => ({
              name: m.project.name,
              color: ['hsl(0 84% 60%)', 'hsl(221 83% 53%)', 'hsl(262 83% 58%)', 'hsl(173 80% 40%)', 'hsl(38 92% 50%)'][i % 5],
              data: (m.platforms.YOUTUBE?.series ?? [])
                .filter((s) => s.metricKey === 'views_28d')
                .map((s) => ({
                  x: new Date(s.capturedAt).toISOString().slice(0, 10),
                  y: s.value,
                })),
            }))}
          emptyMessage="График появится после первых синков. Подключите YouTube в «Настройках»."
        />
      </section>

      {/* §6.4 — Сравнение проектов */}
      <section>
        <ComparisonBar
          title="Сравнение проектов — подписчики YouTube"
          metricLabel="Подписчики"
          data={allMetrics.map((m) => ({
            name: m.project.name,
            slug: m.project.slug,
            value: m.platforms.YOUTUBE?.metrics?.subscribers_total ?? 0,
          }))}
        />
      </section>

      {/* §6.6 — Тепловая карта активности + дневной график */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeekdayHeatmap
          title="Активность по дням недели (§6.6)"
          daily={aggregateDaily}
          emptyMessage="Подключите YouTube хотя бы для одного проекта"
        />
        <DailyViewsChart
          title="Просмотры по дням — все YouTube каналы"
          daily={aggregateDaily}
          emptyMessage="Подключите YouTube хотя бы для одного проекта"
        />
      </section>

      {/* §6.5 — Мини-воронка лидов */}
      {bitrixStages.length > 0 && (
        <section>
          <div className="border border-border rounded-xl bg-background p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">Воронка лидов — Bitrix24 (§6.5)</div>
              <Link href="/leads" className="text-xs text-primary flex items-center gap-1 hover:underline">
                Подробнее <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {bitrixStages.slice(0, 6).map((s) => {
                const max = Math.max(...bitrixStages.map((x) => x.count));
                const pct = max > 0 ? (s.count / max) * 100 : 0;
                const color = s.isWon ? 'bg-success' : s.isLost ? 'bg-danger' : 'bg-primary';
                const label = s.stageName?.replace(/^C\d+:/i, '') ?? s.stageId;
                return (
                  <div key={s.stageId} className="flex items-center gap-3">
                    <div className="w-36 text-xs text-muted-foreground truncate shrink-0">{label}</div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-10 text-xs text-right tabular-nums">{formatNumber(s.count)}</div>
                  </div>
                );
              })}
            </div>
            {bitrixSummary && (
              <div className="mt-3 pt-3 border-t border-border flex gap-6 text-xs text-muted-foreground">
                <span>Всего: <strong className="text-foreground">{formatNumber(bitrixSummary.total)}</strong></span>
                <span>Выиграно: <strong className="text-success">{formatNumber(bitrixSummary.won)}</strong></span>
                <span>Конверсия: <strong className="text-foreground">{bitrixSummary.conversionRate}%</strong></span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* §6.7 — Топ и антирейтинг контента */}
      {token && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopVideos token={token} limit={5} mode="top" />
          <TopVideos token={token} limit={5} mode="bottom" />
        </section>
      )}

      {/* Список проектов с переходом */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Проекты</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="border border-border rounded-xl p-4 bg-background hover:border-primary/30 hover:shadow-sm transition"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-1">/{p.slug}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.platforms.map((pp) => (
                  <span
                    key={pp.id}
                    className={`text-xs px-2 py-0.5 rounded-md ${
                      pp.status === 'ACTIVE'
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {pp.platform}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* §6.2 — что ещё можно подключить */}
      {!metaConfigured && (
        <section className="border border-border rounded-xl p-5 bg-background">
          <div className="font-semibold mb-2">Что появится после подключения Meta Ads и GA4</div>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Общий охват (§6.2) — Meta Reach + GA4 Sessions</li>
            <li>• CPL и расход на рекламу (§6.2) — <Link href="/settings" className="text-primary hover:underline">подключить Meta Ads</Link></li>
            <li>• Воронка лидов из рекламы (§6.5) — Meta lead-формы</li>
          </ul>
        </section>
      )}
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
