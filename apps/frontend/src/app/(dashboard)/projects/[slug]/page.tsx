'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Users, Heart, Play } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { KpiCard } from '@/components/kpi-card';
import { PlatformCard } from '@/components/widgets/platform-card';
import { TrendChart } from '@/components/widgets/trend-chart';
import { DonutChart } from '@/components/widgets/donut-chart';
import { DemographicsPyramid } from '@/components/widgets/demographics-pyramid';
import { WeekdayHeatmap } from '@/components/widgets/weekday-heatmap';
import { DailyViewsChart } from '@/components/widgets/daily-views-chart';
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

function ProjectDetailContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<ProjectMetrics | null>(null);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [detail, setDetail] = useState<YoutubeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<YoutubeVideo | null>(null);
  const [ytPpId, setYtPpId] = useState<string>('');
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
  }, [slug, period]);

  if (error) {
    return <div className="p-6 text-sm text-danger">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const yt = data.platforms.YOUTUBE;
  const totalSubs = yt?.metrics?.subscribers_total ?? 0;
  const total28dViews = yt?.metrics?.views_28d ?? 0;
  const totalVideos = yt?.metrics?.videos_total ?? 0;
  const avgRetention = yt?.metrics?.avg_view_percentage_28d ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* §7.1 Шапка проекта */}
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

      {/* KPI плитки проекта */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Подписчики (YouTube)"
          value={totalSubs || null}
          pending={!yt || yt.status !== 'ACTIVE'}
          pendingNote="Подключите YouTube в «Настройках»"
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Просмотры за 28 дней"
          value={total28dViews || null}
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

      {/* §7.2 Карточки 4 платформ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">По платформам</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const).map((p) => (
            <PlatformCard key={p} platform={p} data={data.platforms[p] as any} />
          ))}
        </div>
      </section>

      {/* §7.6 Динамика — реальный дневной график */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Динамика · {periodLabel}</h2>
        <DailyViewsChart
          title="YouTube — просмотры по дням"
          daily={detail?.daily_views ?? []}
          emptyMessage="Подключите YouTube в «Настройках», чтобы увидеть дневную динамику."
        />
      </section>

      {/* §7.2 / §6.6 — детальные блоки YouTube */}
      {detail && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-3">Аудитория и поведение</h2>
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
              title="Активность по дням недели (§6.6)"
              daily={detail.daily_views}
            />
          </section>
        </>
      )}

      {/* §7.3 Контент — таблица последних видео YouTube */}
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

      {/* Карточка публикации с заметками — §7.3 */}
      {openVideo && (
        <VideoDetailSheet
          video={openVideo}
          projectPlatformId={ytPpId}
          onClose={() => setOpenVideo(null)}
        />
      )}

      {/* §7.4-7.5 заглушки */}
      <section className="border border-border rounded-xl p-5 bg-background">
        <div className="font-semibold mb-2">Что появится здесь после Этапов 2/4 (ТЗ §17)</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• §7.4 UTM-трафик: переходы из видео и постов на сайт</li>
          <li>• §7.5 Лиды от проекта: из Bitrix24 по UTM source/medium/campaign</li>
          <li>• Сравнение с другими проектами (§7.6)</li>
          <li>• Карточки публикаций с детальной аналитикой и заметками (§7.3)</li>
        </ul>
      </section>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
