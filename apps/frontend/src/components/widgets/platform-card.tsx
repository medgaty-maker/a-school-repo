'use client';

import { Youtube, Instagram, Facebook, Music2, CheckCircle2, AlertCircle, Plug } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

type PlatformData = {
  status: string;
  externalAccountName?: string | null;
  lastSyncAt?: string | null;
  metrics: Record<string, number>;
};

type Props = {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
  data: PlatformData;
};

const ICONS = {
  YOUTUBE: Youtube,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
} as const;

const COLORS = {
  YOUTUBE: 'text-red-600',
  INSTAGRAM: 'text-pink-600',
  FACEBOOK: 'text-blue-600',
  TIKTOK: 'text-foreground',
} as const;

// Метрики на карточке для каждой платформы (ТЗ §7.2)
const METRICS_BY_PLATFORM: Record<string, Array<{ key: string; label: string; hint?: string }>> = {
  YOUTUBE: [
    { key: 'subscribers_total', label: 'Подписчики' },
    { key: 'views_28d', label: 'Просмотры (28д)' },
    { key: 'watch_time_minutes_28d', label: 'Время просмотра (мин)' },
    { key: 'avg_view_percentage_28d', label: 'Удержание, %' },
    { key: 'likes_28d', label: 'Лайки (28д)' },
    { key: 'comments_28d', label: 'Комментарии (28д)' },
  ],
  INSTAGRAM: [
    { key: 'followers_count', label: 'Подписчики' },
    { key: 'reach_28d', label: 'Охват (28д)' },
    { key: 'impressions_28d', label: 'Вовлечённость (28д)', hint: 'аккаунтов взаимодействовали' },
    { key: 'profile_visits_28d', label: 'Посещения профиля' },
    { key: 'website_clicks_28d', label: 'Клики по ссылке' },
  ],
  FACEBOOK: [
    { key: 'page_reach_28d', label: 'Охват страницы' },
    { key: 'page_views_28d', label: 'Просмотры страницы' },
    { key: 'reactions_28d', label: 'Реакции' },
  ],
  TIKTOK: [
    { key: 'video_views_28d', label: 'Просмотры видео' },
    { key: 'profile_views_28d', label: 'Посещения профиля' },
    { key: 'likes_28d', label: 'Лайки' },
  ],
};

export function PlatformCard({ platform, data }: Props) {
  const Icon = ICONS[platform];
  const isActive = data.status === 'ACTIVE';
  const metrics = METRICS_BY_PLATFORM[platform] ?? [];

  return (
    <div className="border border-border rounded-xl bg-background p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${COLORS[platform]}`} />
          <div className="font-semibold">{platform}</div>
        </div>
        <PlatformStatusBadge status={data.status} />
      </div>

      {data.externalAccountName && (
        <div className="text-sm text-muted-foreground">
          {data.externalAccountName}
        </div>
      )}

      {!isActive ? (
        <div className="text-xs text-muted-foreground py-3">
          {platform === 'YOUTUBE'
            ? 'Подключите в «Настройки» → выбрать проект → YouTube'
            : `${platform} интеграция — Этап 2 (ТЗ §17)`}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => {
            const v = data.metrics[m.key];
            return (
              <div key={m.key} className="space-y-0.5">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {m.label}
                  {m.hint && (
                    <span title={m.hint} className="cursor-help text-muted-foreground/50 hover:text-muted-foreground">ⓘ</span>
                  )}
                </div>
                {m.hint && (
                  <div className="text-[10px] text-muted-foreground/60 leading-tight">{m.hint}</div>
                )}
                <div className="font-semibold">
                  {v != null ? formatNumber(v) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.lastSyncAt && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          Синк: {new Date(data.lastSyncAt).toLocaleString('ru-RU')}
        </div>
      )}
    </div>
  );
}

function PlatformStatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE')
    return (
      <span className="text-xs flex items-center gap-1 text-success">
        <CheckCircle2 className="size-3.5" /> Активно
      </span>
    );
  if (status === 'ERROR' || status === 'EXPIRED')
    return (
      <span className="text-xs flex items-center gap-1 text-warning">
        <AlertCircle className="size-3.5" /> {status === 'ERROR' ? 'Ошибка' : 'Токен истёк'}
      </span>
    );
  return (
    <span className="text-xs flex items-center gap-1 text-muted-foreground">
      <Plug className="size-3.5" /> Не подключено
    </span>
  );
}
