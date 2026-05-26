'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Users, Heart, Play, Target, BookOpen, TrendingUp, Megaphone } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
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

type AdInsights = { leads: number; spend: number };
type LeadBreakdown = { total: number };
type FunnelSummary = { won: number; inProgress: number };

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
}: {
  ytDaily: Array<{ day: string; views: number }>;
  igSeries: Array<{ metricKey: string; value: number; capturedAt: string }>;
}) {
  const ytMap = new Map(ytDaily.map((d) => [d.day.slice(0, 10), d.views]));
  const igMap = new Map(
    igSeries
      .filter((s) => s.metricKey === 'impressions')
      .map((s) => [s.capturedAt.slice(0, 10), s.value]),
  );

  const allDays = [...new Set([...ytMap.keys(), ...igMap.keys()])].sort();

  if (allDays.length === 0) {
    return (
      <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground bg-background">
        Подключите YouTube или Instagram в «Настройках» для просмотра динамики.
      </div>
    );
  }

  const data = allDays.map((day) => ({
    day: new Date(day).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
    YouTube: ytMap.get(day) ?? null,
    Instagram: igMap.get(day) ?? null,
  }));

  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v} />
          <RechartsTooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(val: number, name: string) => [formatNumber(val), name]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {ytMap.size > 0 && (
            <Line type="monotone" dataKey="YouTube" stroke="#EF4444" strokeWidth={2} dot={false} connectNulls />
          )}
          {igMap.size > 0 && (
            <Line type="monotone" dataKey="Instagram" stroke="#A855F7" strokeWidth={2} dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
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

  const [metaLeads, setMetaLeads] = useState<number>(0);
  const [metricaLeads, setMetricaLeads] = useState<number>(0);
  const [bitrixWon, setBitrixWon] = useState<number>(0);
  const [bitrixActive, setBitrixActive] = useState<number>(0);

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

    // KPI data: leads + Bitrix
    Promise.all([
      apiFetch<AdInsights>('/integrations/meta/ads/insights?datePreset=last_28d', { token }).catch(() => null),
      apiFetch<LeadBreakdown>('/integrations/yandex-metrica/leads?datePreset=last_28d', { token }).catch(() => null),
      apiFetch<{ summary: FunnelSummary }>('/bitrix/funnel?days=90', { token }).catch(() => null),
    ]).then(([meta, metrica, bitrix]) => {
      setMetaLeads(meta?.leads ?? 0);
      setMetricaLeads(metrica?.total ?? 0);
      setBitrixWon(bitrix?.summary?.won ?? 0);
      setBitrixActive(bitrix?.summary?.inProgress ?? 0);
    });
  }, [slug, period]);

  if (error) {
    return <div className="p-6 text-sm text-danger">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const yt = data.platforms.YOUTUBE;
  const ig = data.platforms.INSTAGRAM;

  const totalViews = (yt?.metrics?.views_28d ?? 0) + (ig?.metrics?.impressions ?? 0);
  const totalSubs = (yt?.metrics?.subscribers_total ?? 0) + (ig?.metrics?.followers ?? 0);
  const totalInteractions =
    (yt?.metrics?.likes_28d ?? 0) + (yt?.metrics?.comments_28d ?? 0) +
    (ig?.metrics?.likes ?? 0) + (ig?.metrics?.comments ?? 0);
  const totalLeads = metaLeads + metricaLeads;
  const totalVideos = yt?.metrics?.videos_total ?? 0;
  const avgRetention = yt?.metrics?.avg_view_percentage_28d ?? 0;

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
            pendingNote="Подключите платформы"
          />
          <KpiCard
            label="Подписчики"
            value={totalSubs || null}
            icon={<Users className="size-4" />}
            pendingNote="Подключите платформы"
          />
          <KpiCard
            label="Взаимодействия"
            value={totalInteractions || null}
            icon={<Heart className="size-4" />}
            pendingNote="Нет данных"
          />
          <KpiCard
            label="Лиды"
            value={totalLeads || null}
            icon={<Target className="size-4" />}
            pendingNote="Подключите Meta / Метрику"
          />
          <KpiCard
            label="Записи"
            value={bitrixActive || null}
            icon={<BookOpen className="size-4" />}
            pendingNote="Подключите Bitrix24"
          />
          <KpiCard
            label="Продажи"
            value={bitrixWon || null}
            icon={<TrendingUp className="size-4" />}
            pendingNote="Подключите Bitrix24"
          />
        </div>
      </section>

      {/* Динамика — мультиплатформенный график */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Динамика · {periodLabel}</h2>
        <MultiPlatformChart
          ytDaily={detail?.daily_views ?? []}
          igSeries={ig?.series ?? []}
        />
      </section>

      {/* Карточки платформ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">По платформам</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlatformCard platform="YOUTUBE" data={data.platforms.YOUTUBE as any} />
          <PlatformCard platform="INSTAGRAM" data={data.platforms.INSTAGRAM as any} />
          {/* Meta Ads — ссылка на раздел рекламы */}
          <Link href="/ads" className="block">
            <div className="border border-border rounded-xl p-4 bg-background hover:bg-muted/30 transition-colors flex items-center gap-4">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Megaphone className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Meta Ads</div>
                <div className="text-xs text-muted-foreground">
                  {metaLeads > 0 ? `${formatNumber(metaLeads)} лидов за 28 дней` : 'Реклама в Facebook / Instagram'}
                </div>
              </div>
              <ArrowLeft className="size-4 text-muted-foreground rotate-180" />
            </div>
          </Link>
        </div>
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
