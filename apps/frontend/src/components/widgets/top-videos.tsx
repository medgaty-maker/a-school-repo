'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Heart, MessageCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';

type TopVideo = {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  projectSlug: string;
  projectName: string;
  channelTitle: string | null;
};

type Props = { token: string | null; limit?: number; mode?: 'top' | 'bottom' };

export function TopVideos({ token, limit = 5, mode = 'top' }: Props) {
  const [videos, setVideos] = useState<TopVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const sort = mode === 'bottom' ? '&sort=asc' : '';
    apiFetch<TopVideo[]>(`/integrations/youtube/top-videos?limit=${limit}${sort}`, { token })
      .then(setVideos)
      .catch((e) => setError((e as Error).message));
  }, [token, limit, mode]);

  const isBottom = mode === 'bottom';
  const Icon = isBottom ? TrendingDown : TrendingUp;
  const iconColor = isBottom ? 'text-warning' : 'text-red-600';
  const title = isBottom
    ? `Антирейтинг — ${limit} видео с наименьшим охватом (§6.7)`
    : `Топ-${limit} видео по охвату (§6.7)`;

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`size-4 ${iconColor}`} />
        <div className="font-semibold">{title}</div>
        <div className="ml-auto text-xs text-muted-foreground">
          из всех активных YouTube-каналов
        </div>
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
      )}

      {videos === null && !error ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Загрузка…</div>
      ) : videos && videos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Подключите YouTube хотя бы для одного проекта в «Настройках».
        </div>
      ) : (
        <div className="space-y-2">
          {videos?.map((v) => (
            <a
              key={v.id}
              href={`https://youtu.be/${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-3 p-2 -m-2 rounded-md hover:bg-muted/40 transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail} alt="" className="w-32 h-20 object-cover rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium line-clamp-2 leading-tight">{v.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <Link
                    href={`/projects/${v.projectSlug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-primary"
                  >
                    {v.projectName}
                  </Link>
                  {v.channelTitle && ` · ${v.channelTitle}`}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className={`flex items-center gap-1 ${isBottom ? 'text-warning' : ''}`}>
                    <Eye className="size-3" /> {formatNumber(v.views)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="size-3" /> {formatNumber(v.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="size-3" /> {formatNumber(v.comments)}
                  </span>
                  <span className="ml-auto">
                    {new Date(v.publishedAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
