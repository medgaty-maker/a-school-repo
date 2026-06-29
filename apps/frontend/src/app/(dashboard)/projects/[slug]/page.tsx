'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Users, Heart, Play, Target, BookOpen, TrendingUp, Megaphone, Sparkles, AlertCircle, TrendingDown, Info, ChevronDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { apiFetch } from '@/lib/api-client';
import { KpiCard } from '@/components/kpi-card';
import { PlatformCard } from '@/components/widgets/platform-card';
import { DonutChart } from '@/components/widgets/donut-chart';
import { DemographicsPyramid } from '@/components/widgets/demographics-pyramid';
import { WeekdayHeatmap } from '@/components/widgets/weekday-heatmap';
import { CountriesList } from '@/components/widgets/countries-list';
import { VideoDetailSheet } from '@/components/widgets/video-detail-sheet';
import { formatNumber } from '@/lib/utils';
import { usePeriod, PERIODS } from '@/lib/use-period';

type ProjectMetrics = {
  project: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priority: string;
  };
  platforms: Record<
    string,
    {
      status: string;
      externalAccountName?: string | null;
      lastSyncAt?: string | null;
      metrics: Record<string, number>;
      series: Array<{ metricKey: string; value: number; capturedAt: string }>;
    }
  >;
  period: { since: string; daysBack: number };
};

type YoutubeVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
};

type YoutubeDetail = {
  period: { startDate: string; endDate: string };
  totals: Record<string, number>;
  daily_views: Array<{ day: string; views: number; estimatedMinutesWatched: number }>;
  traffic_sources: Array<{ insightTrafficSourceType: string; views: number }>;
  demographics: Array<{ ageGroup: string; gender: string; viewerPercentage: number }>;
  countries: Array<{ country: string; views: number }>;
  devices: Array<{ deviceType: string; views: number }>;
  operating_systems: Array<{ operatingSystem: string; views: number }>;
};

type AdInsights = { leads: number; spend: number; impressions: number; clicks: number; reach: number; ctr: number; cpc: number; cpl: number; roas: number; kztRate: number };
type LeadBreakdown = { total: number };
type PipelineFunnel = {
  won: number; inProgress: number; lost: number; total: number; totalAmount: number;
  pipelines?: Array<{ categoryId: string; name: string; won: number; inProgress: number; total: number }>;
};
type MetaDaily = Array<{ date: string; impressions: number; spend: number; leads: number }>;
type YandexDaily = Array<{ date: string; visits: number }>;
type AiRecommendation = { priority: string; page: string; issue: string; recommendation: string; expectedImpact: string };
type AiInsights = { recommendations: AiRecommendation[]; summary: string; generatedAt: string };

const PRIORITY_LABEL: Record<string, string> = {
  BRAND: 'Бренд',
  SALES: 'Продажи',
  BOTH: 'Бренд + Продажи',
};

export default function ProjectDetailPage() {
  return (
    <Suspense>
      <ProjectDetailContent />
    </Suspense>
  );
}

function MultiPlatformChart({
  ytDaily,
  igSeries,
  metaDaily,
  yandexDaily,
  metric,
  onMetricChange,
}: {
  ytDaily: Array<{ day: string; views: number }>;
  igSeries: Array<{ metricKey: string; value: number; capturedAt: string }>;
  metaDaily: MetaDaily;
  yandexDaily: YandexDaily;
  metric: 'views' | 'leads';
  onMetricChange: (m: 'views' | 'leads') => void;
}) {
  const ytMap = new Map(ytDaily.map((d) => [d.day.slice(0, 10), d.views]));
  const igMap = new Map(
    igSeries
      .filter((s) => s.metricKey === 'views_28d')
      .map((s) => [s.capturedAt.slice(0, 10), s.value]),
  );
  const metaViewsMap = new Map(metaDaily.map((d) => [d.date, d.impressions]));
  const metaLeadsMap = new Map(metaDaily.map((d) => [d.date, d.leads]));
  const yandexMap = new Map(yandexDaily.map((d) => [d.date, d.visits]));
  const yandexMax = yandexMap.size > 0
    ? Math.ceil(Math.max(...Array.from(yandexMap.values())) * 1.15 / 500) * 500
    : 5000;

  const isValidDay = (d: string) => !!d && !isNaN(new Date(d).getTime());
  const allDays = (metric === 'views'
    ? [...new Set([...ytMap.keys(), ...igMap.keys(), ...metaViewsMap.keys(), ...yandexMap.keys()])]
    : [...metaLeadsMap.keys()]
  ).filter(isValidDay).sort();

  const data = allDays.map((day) => {
    const label = new Date(day).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    if (metric === 'leads') {
      return { day: label, 'Meta Лиды': metaLeadsMap.get(day) ?? null };
    }
    return {
      day: label,
      YouTube: ytMap.get(day) ?? null,
      Instagram: igMap.get(day) ?? null,
      'Meta Ads': metaViewsMap.get(day) ?? null,
      'Яндекс': yandexMap.get(day) ?? null,
    };
  });

  return (
    <div className="border border-border rounded-xl p-4 bg-background space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => onMetricChange('views')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${metric === 'views' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
        >
          Просмотры
        </button>
        <button
          onClick={() => onMetricChange('leads')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${metric === 'leads' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
        >
          Лиды
        </button>
      </div>
      {allDays.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-center text-sm text-muted-foreground">
          {metric === 'leads'
            ? 'Нет данных по лидам за период. Подключите Meta Ads в «Настройках».'
            : 'Подключите YouTube, Instagram или Meta Ads в «Настройках» для просмотра динамики.'}
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 50, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          {/* Левая ось — Meta Ads, YouTube (крупные значения) */}
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
          />
          {/* Правая ось — Яндекс с независимым масштабом */}
          {metric === 'views' && yandexMap.size > 0 && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, yandexMax]}
              allowDataOverflow={false}
              tick={{ fontSize: 10, fill: '#FFCC00' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
              width={40}
            />
          )}
          <RechartsTooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(val: number, name: string) => [formatNumber(val), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {metric === 'views' && ytMap.size > 0 && (
            <Line yAxisId="left" type="monotone" dataKey="YouTube" stroke="#EF4444" strokeWidth={2} dot={false} connectNulls />
          )}
          {metric === 'views' && igMap.size > 0 && (
            <Line yAxisId="left" type="monotone" dataKey="Instagram" stroke="#A855F7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          )}
          {metric === 'views' && metaViewsMap.size > 0 && (
            <Line yAxisId="left" type="monotone" dataKey="Meta Ads" stroke="#3B82F6" strokeWidth={2} dot={false} connectNulls />
          )}
          {metric === 'views' && yandexMap.size > 0 && (
            <Line yAxisId="right" type="monotone" dataKey="Яндекс" stroke="#FFCC00" strokeWidth={2} dot={false} connectNulls />
          )}
          {metric === 'leads' && metaLeadsMap.size > 0 && (
            <Line yAxisId="left" type="monotone" dataKey="Meta Лиды" stroke="#3B82F6" strokeWidth={2} dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}

function ProjectDetailContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<ProjectMetrics | null>(null);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [detail, setDetail] = useState<YoutubeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<YoutubeVideo | null>(null);
  const [ytPpId, setYtPpId] = useState<string>('');

  const [metaInsights, setMetaInsights] = useState<AdInsights | null>(null);
  const [metaLeads, setMetaLeads] = useState<number>(0);
  const [metricaLeads, setMetricaLeads] = useState<number>(0);
  const [bitrixWon, setBitrixWon] = useState<number>(0);
  const [bitrixActive, setBitrixActive] = useState<number>(0);
  const [bitrixFunnel, setBitrixFunnel] = useState<PipelineFunnel | null>(null);
  const [metaDaily, setMetaDaily] = useState<MetaDaily>([]);
  const [yandexDaily, setYandexDaily] = useState<YandexDaily>([]);
  const [chartMetric, setChartMetric] = useState<'views' | 'leads'>('views');
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [salesOpen, setSalesOpen] = useState(false);

  const { period } = usePeriod();
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token || !slug) return;

    apiFetch<ProjectMetrics>(`/projects/${slug}/metrics?period=${period}`, { token })
      .then(async (m) => {
        setData(m);
        const yt = m.platforms.YOUTUBE as any;
        if (yt?.status === 'ACTIVE' && yt.projectPlatformId) {
          setYtPpId(yt.projectPlatformId);
          try {
            const [v, d] = await Promise.all([
              apiFetch<YoutubeVideo[]>(
                `/integrations/youtube/${yt.projectPlatformId}/videos?limit=10`,
                { token },
              ),
              apiFetch<YoutubeDetail>(
                `/integrations/youtube/${yt.projectPlatformId}/detail`,
                { token },
              ),
            ]);
            setVideos(v);
            setDetail(d);
          } catch (e) {
            console.error(e);
          }
        }
      })
      .catch((e) => setError((e as Error).message));

    // KPI data: leads + Bitrix pipeline + Meta daily chart + Yandex daily
    setKpiLoading(true);
    Promise.all([
      apiFetch<AdInsights>(`/integrations/meta/ads/insights?datePreset=last_28d&project=${slug}`, { token }).catch(() => null),
      apiFetch<LeadBreakdown>(`/integrations/yandex-metrica/leads?datePreset=last_28d&project=${slug}`, { token }).catch(() => null),
      apiFetch<PipelineFunnel>(`/bitrix/pipeline-funnel?days=30&project=${slug}`, { token }).catch(() => null),
      apiFetch<MetaDaily>(`/integrations/meta/ads/insights-daily?datePreset=last_28d&project=${slug}`, { token }).catch(() => null),
      apiFetch<YandexDaily>(`/integrations/yandex-metrica/visits-daily?datePreset=last_28d&project=${slug}`, { token }).catch(() => null),
    ]).then(([meta, metrica, bitrix, metaDailyData, yandexDailyData]) => {
      if (meta) setMetaInsights(meta);
      setMetaLeads(meta?.leads ?? 0);
      setMetricaLeads(metrica?.total ?? 0);
      setBitrixWon(bitrix?.won ?? 0);
      setBitrixActive(bitrix?.inProgress ?? 0);
      setBitrixFunnel(bitrix ?? null);
      if (metaDailyData) setMetaDaily(metaDailyData);
      if (yandexDailyData) setYandexDaily(yandexDailyData);
    }).finally(() => setKpiLoading(false));
  }, [slug, period]);

  if (error) {
    return <div className="p-6 text-sm text-danger">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const yt = data.platforms.YOUTUBE;
  const ig = data.platforms.INSTAGRAM;

  const metaImpressions = metaDaily.reduce((s, d) => s + d.impressions, 0);
  const yandexVisits = yandexDaily.reduce((s, d) => s + d.visits, 0);
  const totalViews =
    (yt?.metrics?.views_28d ?? 0)
    + (ig?.metrics?.views_28d ?? 0)
    + metaImpressions
    + yandexVisits;
  const totalSubs =
    (yt?.metrics?.subscribers_total ?? 0)
    + (ig?.metrics?.followers_count ?? 0);
  const totalInteractions =
    (ig?.metrics?.total_interactions_28d ?? 0)
    + (yt?.metrics?.likes_28d ?? 0)
    + (yt?.metrics?.comments_28d ?? 0);
  const totalLeads = metaLeads + metricaLeads;
  const totalVideos = yt?.metrics?.videos_total ?? 0;
  const avgRetention = yt?.metrics?.avg_view_percentage_28d ?? 0;

  // Разбивка продаж: Лагерь (categoryId 58) vs Школа (все остальные воронки)
  const salesPipelines = bitrixFunnel?.pipelines ?? [];
  const campSales = salesPipelines
    .filter((p) => p.categoryId === '58')
    .reduce((s, p) => s + p.won, 0);
  const schoolSales = salesPipelines
    .filter((p) => p.categoryId !== '58')
    .reduce((s, p) => s + p.won, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Шапка */}
      <header className="space-y-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Все проекты
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{data.project.name}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs">
            {PRIORITY_LABEL[data.project.priority] ?? data.project.priority}
          </span>
          {data.project.description && (
            <span className="text-muted-foreground">{data.project.description}</span>
          )}
        </div>
      </header>

      {/* Суммарные KPI по всем платформам */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Общие показатели · {periodLabel}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="Просмотры"
            value={totalViews || null}
            icon={<Eye className="size-4" />}
            hint={`YouTube/IG ${formatNumber((yt?.metrics?.views_28d ?? 0) + (ig?.metrics?.views_28d ?? 0))} · Meta ${formatNumber(metaImpressions)} · Яндекс ${formatNumber(yandexVisits)}`}
            pendingNote="Подключите платформы"
          />
          <KpiCard
            label="Подписчики"
            value={totalSubs || null}
            icon={<Users className="size-4" />}
            hint="Источники: YouTube + Instagram"
            pendingNote="Подключите платформы"
          />
          <KpiCard
            label="Взаимодействия"
            value={totalInteractions || null}
            icon={<Heart className="size-4" />}
            hint="Источники: Instagram + YouTube"
            pendingNote="Нет данных"
          />
          <KpiCard
            label="Лиды"
            value={totalLeads || null}
            icon={<Target className="size-4" />}
            hint={`Метрика ${formatNumber(metricaLeads)} · Meta ${formatNumber(metaLeads)}`}
            pendingNote="Подключите Meta / Метрику"
          />
          <KpiCard
            label="Сделки"
            value={bitrixActive || null}
            icon={<BookOpen className="size-4" />}
            hint="Bitrix24 · в работе, 30 дней"
            pendingNote="Подключите Bitrix24"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setSalesOpen((v) => !v)}
              className="group block w-full h-full text-left rounded-xl ring-1 ring-primary/30 hover:ring-2 hover:ring-primary/60 transition"
              title="Показать разбивку Школа / Лагерь"
            >
              <KpiCard
                label="Продажи"
                value={bitrixWon || null}
                icon={<ChevronDown className={`size-4 text-primary transition-transform ${salesOpen ? 'rotate-180' : ''}`} />}
                hint="Bitrix24 · 30 дней · нажмите для разбивки"
                pendingNote="Подключите Bitrix24"
              />
            </button>
            {/* Маленький список прямо под карточкой */}
            {salesOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-border rounded-lg bg-background shadow-lg divide-y divide-border">
                <div className="px-3 py-2 flex items-center justify-between text-sm">
                  <span>Школа</span>
                  <span className="font-semibold tabular-nums">{formatNumber(schoolSales)}</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between text-sm">
                  <span>Лагерь</span>
                  <span className="font-semibold tabular-nums">{formatNumber(campSales)}</span>
                </div>
                <div className="px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Всего</span>
                  <span className="tabular-nums">{formatNumber(schoolSales + campSales)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Динамика — мультиплатформенный график */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Динамика · {periodLabel}</h2>
        <MultiPlatformChart
          ytDaily={detail?.daily_views ?? []}
          igSeries={ig?.series ?? []}
          metaDaily={metaDaily}
          yandexDaily={yandexDaily}
          metric={chartMetric}
          onMetricChange={setChartMetric}
        />
      </section>

      {/* Карточки платформ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">По платформам</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformCard platform="YOUTUBE" data={data.platforms.YOUTUBE as any} />
          <PlatformCard platform="INSTAGRAM" data={data.platforms.INSTAGRAM as any} />
          <MetaAdsCard insights={metaInsights} kztRate={metaInsights?.kztRate ?? 460} loading={kpiLoading} />
          <BitrixCard funnel={bitrixFunnel} loading={kpiLoading} />
        </div>
      </section>

      {/* AI Webvisor рекомендации */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> AI-рекомендации по сайту
          </h2>
          {!aiInsights && (
            <button
              onClick={() => {
                const token = readCookie('access_token');
                if (!token) return;
                setAiLoading(true);
                apiFetch<AiInsights>('/integrations/yandex-metrica/ai-insights', { token })
                  .then(setAiInsights)
                  .catch(() => {})
                  .finally(() => setAiLoading(false));
              }}
              disabled={aiLoading}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {aiLoading ? <span className="animate-spin inline-block size-3.5 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles className="size-3.5" />}
              {aiLoading ? 'Анализирую…' : 'Получить рекомендации'}
            </button>
          )}
        </div>
        {aiInsights ? (
          <div className="space-y-3">
            {aiInsights.summary && (
              <div className="border border-border rounded-xl p-4 bg-muted/30 text-sm flex gap-3">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <span>{aiInsights.summary}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {aiInsights.recommendations.map((r, i) => (
                <div key={i} className="border border-border rounded-xl p-4 bg-background space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.priority === 'высокий' ? 'bg-danger/10 text-danger' :
                      r.priority === 'средний' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>{r.priority}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{r.page}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{r.issue}</span>
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">{r.recommendation}</div>
                  <div className="flex items-center gap-2 pl-6">
                    <TrendingDown className="size-3.5 text-success" />
                    <span className="text-xs text-success">{r.expectedImpact}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground text-right">
              Сгенерировано {new Date(aiInsights.generatedAt).toLocaleString('ru-RU')}
              <button onClick={() => setAiInsights(null)} className="ml-3 underline">Обновить</button>
            </div>
          </div>
        ) : (
          !aiLoading && (
            <div className="border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
              Нажмите «Получить рекомендации» — Claude проанализирует поведение посетителей и предложит улучшения
            </div>
          )
        )}
      </section>

      {/* YouTube детальная аналитика */}
      {detail && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-3">YouTube — аудитория и поведение</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DonutChart
                title="Источники трафика"
                data={detail.traffic_sources.map((t) => ({
                  name: t.insightTrafficSourceType,
                  value: t.views,
                }))}
              />
              <DonutChart
                title="Устройства"
                data={detail.devices.map((d) => ({ name: d.deviceType, value: d.views }))}
              />
              <DonutChart
                title="Операционные системы"
                data={detail.operating_systems.map((d) => ({
                  name: d.operatingSystem,
                  value: d.views,
                }))}
              />
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DemographicsPyramid
                title="Демография зрителей"
                data={detail.demographics}
              />
              <CountriesList
                title="Топ-10 стран"
                data={detail.countries}
              />
            </div>
          </section>

          <section>
            <WeekdayHeatmap
              title="Активность по дням недели"
              daily={detail.daily_views}
            />
          </section>

          {/* YouTube KPI */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Подписчики (YouTube)"
              value={(yt?.metrics?.subscribers_total) || null}
              pending={!yt || yt.status !== 'ACTIVE'}
              pendingNote="Подключите YouTube в «Настройках»"
              icon={<Users className="size-4" />}
            />
            <KpiCard
              label="Просмотры за 28 дней"
              value={(yt?.metrics?.views_28d) || null}
              pending={!yt || yt.status !== 'ACTIVE'}
              pendingNote="Подключите YouTube в «Настройках»"
              icon={<Eye className="size-4" />}
            />
            <KpiCard
              label="Видео всего"
              value={totalVideos || null}
              pending={!yt || yt.status !== 'ACTIVE'}
              pendingNote="Подключите YouTube"
              icon={<Play className="size-4" />}
            />
            <KpiCard
              label="Среднее удержание"
              value={avgRetention ? `${avgRetention.toFixed(1)}%` : null}
              pending={!yt || yt.status !== 'ACTIVE'}
              pendingNote="Подключите YouTube"
              icon={<Heart className="size-4" />}
            />
          </section>
        </>
      )}

      {/* Последние видео YouTube */}
      {videos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Последние видео (YouTube)</h2>
          <div className="border border-border rounded-xl bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Видео</th>
                  <th className="text-right px-3 py-2">Просмотры</th>
                  <th className="text-right px-3 py-2">Лайки</th>
                  <th className="text-right px-3 py-2">Комментарии</th>
                  <th className="text-right px-4 py-2">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {videos.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setOpenVideo(v)}
                    className="hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.thumbnail} alt="" className="w-20 h-12 object-cover rounded" />
                        <span className="hover:text-primary line-clamp-2">{v.title}</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2">{formatNumber(v.views)}</td>
                    <td className="text-right px-3 py-2">{formatNumber(v.likes)}</td>
                    <td className="text-right px-3 py-2">{formatNumber(v.comments)}</td>
                    <td className="text-right px-4 py-2 text-xs text-muted-foreground">
                      {new Date(v.publishedAt).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {openVideo && (
        <VideoDetailSheet
          video={openVideo}
          projectPlatformId={ytPpId}
          onClose={() => setOpenVideo(null)}
        />
      )}
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function MetaAdsCard({ insights, kztRate, loading }: { insights: AdInsights | null; kztRate: number; loading?: boolean }) {
  function fmtUsd(n: number) {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }
  function fmtBoth(usd: number) {
    return `${fmtUsd(usd)} / ₸${Math.round(usd * kztRate).toLocaleString('ru-RU')}`;
  }

  const metrics = insights
    ? [
        { label: 'Показы', value: formatNumber(insights.impressions) },
        { label: 'Охват', value: formatNumber(insights.reach) },
        { label: 'Клики', value: formatNumber(insights.clicks) },
        { label: 'CTR', value: `${insights.ctr.toFixed(2)}%` },
        { label: 'Лиды', value: formatNumber(insights.leads) },
        { label: 'CPL', value: insights.cpl > 0 ? fmtBoth(insights.cpl) : '—' },
        { label: 'Расход', value: fmtBoth(insights.spend) },
        { label: 'ROAS', value: insights.roas > 0 ? `${insights.roas.toFixed(2)}x` : '—' },
      ]
    : [];

  return (
    <div className="border border-border rounded-xl bg-background p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-blue-500" />
          <div className="font-semibold">Meta Ads</div>
        </div>
        {insights ? (
          <span className="text-xs flex items-center gap-1 text-success">
            <TrendingUp className="size-3.5" /> Активно
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">нет данных</span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">Facebook / Instagram реклама</div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-3 animate-pulse">Загрузка…</div>
      ) : !insights ? (
        <div className="text-xs text-muted-foreground py-3">Нет данных за 28 дней</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-0.5">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="font-semibold text-sm">{m.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-border pt-3">
        <Link href="/ads" className="text-xs text-primary hover:underline flex items-center gap-1">
          Подробнее по кампаниям <ArrowLeft className="size-3 rotate-180" />
        </Link>
      </div>
    </div>
  );
}

function BitrixCard({ funnel, loading }: { funnel: PipelineFunnel | null; loading?: boolean }) {
  const hasData = !!funnel && funnel.total > 0;
  const conv = funnel && funnel.total > 0 ? `${Math.round((funnel.won / funnel.total) * 1000) / 10}%` : '—';
  const metrics = funnel
    ? [
        { label: 'Всего сделок', value: formatNumber(funnel.total) },
        { label: 'В работе', value: formatNumber(funnel.inProgress) },
        { label: 'Выиграно', value: formatNumber(funnel.won) },
        { label: 'Проиграно', value: formatNumber(funnel.lost) },
        { label: 'Конверсия', value: conv },
        { label: 'Сумма (выигр.)', value: funnel.totalAmount > 0 ? formatNumber(funnel.totalAmount) : '—' },
      ]
    : [];

  return (
    <div className="border border-border rounded-xl bg-background p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-primary" />
          <div className="font-semibold">Bitrix24 — лиды и продажи</div>
        </div>
        {hasData ? (
          <span className="text-xs flex items-center gap-1 text-success">
            <TrendingUp className="size-3.5" /> Активно
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">нет данных</span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">Сделки по воронкам проекта · 90 дней</div>
      {loading ? (
        <div className="text-xs text-muted-foreground py-3 animate-pulse">Загрузка…</div>
      ) : !hasData ? (
        <div className="text-xs text-muted-foreground py-3">
          Нет привязанных воронок. Назначь их в «Настройках → Привязка источников к проектам».
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="space-y-0.5">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="font-semibold text-sm">{m.value}</div>
              </div>
            ))}
          </div>
          {funnel?.pipelines && funnel.pipelines.length > 0 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="text-xs text-muted-foreground">Топ воронок</div>
              {funnel.pipelines.slice(0, 4).map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate text-muted-foreground">{p.name.replace(/^C\d+:/, '')}</span>
                  <span className="tabular-nums shrink-0">{formatNumber(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="border-t border-border pt-3">
        <Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
          Подробнее по сделкам <ArrowLeft className="size-3 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
