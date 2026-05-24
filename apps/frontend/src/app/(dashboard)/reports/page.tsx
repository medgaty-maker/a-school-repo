'use client';

import { useEffect, useState, Suspense } from 'react';
import { Printer, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';
import { usePeriod, PERIODS } from '@/lib/use-period';

type Project = {
  id: string;
  slug: string;
  name: string;
  priority: string;
  platforms: Array<{ id: string; platform: string; status: string; externalAccountName: string | null }>;
};

type Insight = { id: string; severity: string; title: string; description: string };

type ProjectMetrics = {
  project: { slug: string; name: string };
  platforms: Record<string, { metrics: Record<string, number>; status: string }>;
};

const PRIORITY_LABEL: Record<string, string> = {
  BRAND: 'Бренд',
  SALES: 'Продажи',
  BOTH: 'Бренд + Продажи',
};

const SEV_COLOR: Record<string, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-primary',
};

function ReportsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [allMetrics, setAllMetrics] = useState<ProjectMetrics[]>([]);
  const { period } = usePeriod();
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    (async () => {
      try {
        const [list, ins] = await Promise.all([
          apiFetch<Project[]>('/projects', { token }),
          apiFetch<Insight[]>('/insights', { token }),
        ]);
        setProjects(list);
        setInsights(ins);
        const settled = await Promise.allSettled(
          list.map((p) =>
            apiFetch<ProjectMetrics>(`/projects/${p.slug}/metrics?period=${period}`, { token }),
          ),
        );
        setAllMetrics(
          settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [period]);

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  function exportCSV() {
    const cols = ['Проект', 'Приоритет', 'Подписчики', 'Просмотры (28д)', 'Просмотры (всего)', 'Видео', 'Удержание (%)'];
    const rows = allMetrics.map((m) => {
      const yt = m.platforms.YOUTUBE?.metrics ?? {};
      const proj = projects.find((p) => p.slug === m.project.slug);
      return [
        m.project.name,
        PRIORITY_LABEL[proj?.priority ?? 'BRAND'] ?? proj?.priority,
        yt.subscribers_total ?? '',
        yt.views_28d ?? '',
        yt.views_total ?? '',
        yt.videos_total ?? '',
        yt.avg_view_percentage_28d?.toFixed(1) ?? '',
      ];
    });
    const csv = [cols, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `отчёт-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const totals = allMetrics.reduce(
    (acc, m) => {
      const yt = m.platforms.YOUTUBE?.metrics ?? {};
      acc.subscribers += yt.subscribers_total ?? 0;
      acc.views28d += yt.views_28d ?? 0;
      acc.viewsTotal += yt.views_total ?? 0;
      acc.videos += yt.videos_total ?? 0;
      return acc;
    },
    { subscribers: 0, views28d: 0, viewsTotal: 0, videos: 0 },
  );

  return (
    <div className="p-6 space-y-6 print:p-0">
      <header className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Отчёты</h1>
          <p className="text-sm text-muted-foreground">
            Период: <span className="font-medium text-foreground">{periodLabel}</span> · MVP — PDF через браузер, CSV.
            Конструктор отчётов и рассылка — Этап 6.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={allMetrics.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="size-4" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            <Printer className="size-4" /> PDF
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
        <ReportTemplate
          icon={<FileText className="size-5" />}
          title="Текущий снимок (PDF)"
          description="Эта страница, оптимизированная для печати: KPI, метрики проектов, инсайты."
          action="Печать или Cmd+P"
          available
        />
        <ReportTemplate
          icon={<Calendar className="size-5" />}
          title="Еженедельный отчёт директору"
          description="Краткий 2–3 страницы с динамикой, ключевыми событиями и рекомендациями."
          action="Этап 6 — конструктор отчётов §13.2"
        />
        <ReportTemplate
          icon={<FileSpreadsheet className="size-5" />}
          title="Excel-выгрузка"
          description="Все snapshots, видео, лиды — для расчётов в таблицах."
          action="Этап 6 — экспорт §13.3"
        />
      </section>

      <article className="print:text-black">
        <header className="mb-6 print:mb-4">
          <div className="text-xs text-muted-foreground">Авторская школа Жании Аубакировой · Маркетинговый дашборд</div>
          <h2 className="text-3xl font-bold mt-1">Сводка по проектам</h2>
          <div className="text-sm text-muted-foreground mt-1">{today} · период: {periodLabel}</div>
        </header>

        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Ключевые показатели</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiRow label="Подписчики (всего)" value={totals.subscribers} />
            <KpiRow label="Просмотры (28 дней)" value={totals.views28d} />
            <KpiRow label="Просмотры (за всё время)" value={totals.viewsTotal} />
            <KpiRow label="Видео" value={totals.videos} />
          </div>
        </section>

        {insights.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Инсайты</h3>
            <ul className="space-y-1.5">
              {insights.slice(0, 8).map((i) => (
                <li key={i.id} className="text-sm">
                  <span className={`mr-2 ${SEV_COLOR[i.severity] ?? ''}`}>●</span>
                  <span className="font-medium">{i.title}.</span>{' '}
                  <span className="text-muted-foreground">{i.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-3">По проектам</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left py-2">Проект</th>
                <th className="text-left py-2">Приоритет</th>
                <th className="text-right py-2">Подписчики</th>
                <th className="text-right py-2">Просмотры (28д)</th>
                <th className="text-right py-2">Видео</th>
                <th className="text-right py-2">Удержание</th>
              </tr>
            </thead>
            <tbody>
              {allMetrics.map((m) => {
                const yt = m.platforms.YOUTUBE?.metrics ?? {};
                const project = projects.find((p) => p.slug === m.project.slug);
                return (
                  <tr key={m.project.slug} className="border-b border-border">
                    <td className="py-2">
                      <div className="font-medium">{m.project.name}</div>
                      <div className="text-xs text-muted-foreground">/{m.project.slug}</div>
                    </td>
                    <td className="py-2 text-xs">{PRIORITY_LABEL[project?.priority ?? 'BRAND']}</td>
                    <td className="py-2 text-right tabular-nums">
                      {yt.subscribers_total ? formatNumber(yt.subscribers_total) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {yt.views_28d ? formatNumber(yt.views_28d) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">{yt.videos_total ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums">
                      {yt.avg_view_percentage_28d ? `${yt.avg_view_percentage_28d.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <footer className="text-xs text-muted-foreground pt-4 border-t border-border">
          Сгенерировано {new Date().toLocaleString('ru-RU')} · Маркетинговый дашборд v0.2 ·
          Источники: YouTube Data API v3, YouTube Analytics API v2.
        </footer>
      </article>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  );
}

function KpiRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{formatNumber(value)}</div>
    </div>
  );
}

function ReportTemplate({ icon, title, description, action, available }: {
  icon: React.ReactNode; title: string; description: string; action: string; available?: boolean;
}) {
  return (
    <div className={`border border-border rounded-xl p-5 bg-background ${available ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2 text-primary mb-2">{icon}</div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
      <div className="text-xs mt-3 text-primary">{action}</div>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
