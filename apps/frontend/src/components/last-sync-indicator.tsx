'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type Project = {
  platforms: Array<{
    platform: string;
    status: string;
    lastSyncAt: string | null;
  }>;
};

type Summary = { platform: string; lastSync: Date | null; activeCount: number; errorCount: number };

const PRIORITY_PLATFORMS = ['YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK'] as const;

function formatAgo(d: Date | null): string {
  if (!d) return '—';
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  return `${days} дн назад`;
}

export function LastSyncIndicator() {
  const [summary, setSummary] = useState<Summary[]>([]);

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;

    apiFetch<Project[]>('/projects', { token })
      .then((projects) => {
        const byPlatform: Record<string, { latest: Date | null; active: number; error: number }> = {};
        for (const p of projects) {
          for (const pp of p.platforms) {
            if (!byPlatform[pp.platform]) byPlatform[pp.platform] = { latest: null, active: 0, error: 0 };
            const entry = byPlatform[pp.platform];
            if (pp.status === 'ACTIVE') {
              entry.active++;
              if (pp.lastSyncAt) {
                const d = new Date(pp.lastSyncAt);
                if (!entry.latest || d > entry.latest) entry.latest = d;
              }
            } else if (pp.status === 'ERROR') {
              entry.error++;
            }
          }
        }
        setSummary(
          PRIORITY_PLATFORMS.map((platform) => ({
            platform,
            lastSync: byPlatform[platform]?.latest ?? null,
            activeCount: byPlatform[platform]?.active ?? 0,
            errorCount: byPlatform[platform]?.error ?? 0,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  // Только платформы где есть хоть что-то активное или ошибки
  const visible = summary.filter((s) => s.activeCount > 0 || s.errorCount > 0);
  if (visible.length === 0) return null;

  return (
    <Link
      href="/settings"
      className="flex items-center gap-3 text-xs px-2 py-1 rounded-md hover:bg-muted transition"
      title="Подробнее в Настройках"
    >
      <Activity className="size-3.5 text-muted-foreground" />
      {visible.map((s) => {
        const stale = s.lastSync && Date.now() - s.lastSync.getTime() > 24 * 3_600_000;
        const Icon = s.errorCount > 0 ? AlertTriangle : stale ? AlertTriangle : CheckCircle2;
        const color = s.errorCount > 0 ? 'text-danger' : stale ? 'text-warning' : 'text-success';
        return (
          <span key={s.platform} className="flex items-center gap-1">
            <Icon className={`size-3 ${color}`} />
            <span className="text-muted-foreground">
              {s.platform[0]}{s.platform[1]?.toLowerCase()}{s.platform[2]?.toLowerCase()}
            </span>
            <span className={color}>{formatAgo(s.lastSync)}</span>
          </span>
        );
      })}
    </Link>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
