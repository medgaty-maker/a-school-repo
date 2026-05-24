'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Youtube, Instagram, Facebook, Music2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type Project = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priority: 'BRAND' | 'SALES' | 'BOTH';
  platforms: Array<{
    id: string;
    platform: string;
    externalAccountName: string | null;
    status: string;
    lastSyncAt: string | null;
  }>;
};

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  BRAND: { label: 'Бренд', cls: 'bg-primary/10 text-primary' },
  SALES: { label: 'Продажи', cls: 'bg-success/10 text-success' },
  BOTH: { label: 'Бренд + Продажи', cls: 'bg-warning/10 text-warning' },
};

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  YOUTUBE: Youtube,
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TIKTOK: Music2,
};

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<Project[]>('/projects', { token })
      .then(setProjects)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Проекты</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} активных контентных проектов школы. Кликните на карточку для детальной аналитики (§7 ТЗ).
        </p>
      </header>

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const priority = PRIORITY_LABEL[p.priority] ?? PRIORITY_LABEL.BRAND;
          const activePlatforms = p.platforms.filter((pp) => pp.status === 'ACTIVE');
          return (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="group border border-border rounded-xl bg-background p-5 hover:shadow-md hover:border-primary/30 transition"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-semibold leading-tight">{p.name}</div>
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${priority.cls}`}>
                  {priority.label}
                </span>
              </div>

              {p.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
              )}

              <div className="mt-4 flex items-center gap-1.5">
                {p.platforms.map((pp) => {
                  const Icon = PLATFORM_ICONS[pp.platform];
                  return (
                    <div
                      key={pp.id}
                      className={`size-8 rounded-md grid place-items-center ${
                        pp.status === 'ACTIVE'
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      title={`${pp.platform}: ${pp.status}`}
                    >
                      {Icon && <Icon className="size-4" />}
                    </div>
                  );
                })}
                <div className="ml-auto text-xs text-muted-foreground">
                  {activePlatforms.length} / 4 подключено
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition">
                Открыть аналитику <ArrowRight className="size-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
