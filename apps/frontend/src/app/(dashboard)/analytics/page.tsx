'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { Activity, TrendingUp, DollarSign, Users, CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatNumber } from '@/lib/utils';

type Stage = { key: string; label: string; value: number; convFromPrev: number | null; note?: string };
type Deltas = { leads: number | null; deals: number | null; sales: number | null; revenue: number | null; avgCheck: number | null };
type SalesFunnel = { categoryId: string; name: string; count: number; revenue: number };
type Signal = { level: 'danger' | 'warning' | 'info'; text: string };
type Funnel = {
  daysBack: number;
  stages: Stage[];
  revenue: number;
  avgCheck: number;
  leadToSale: number | null;
  enrolledTotal: number | null;
  deltas: Deltas;
  salesByFunnel: SalesFunnel[];
  signals: Signal[];
};
type HealthItem = {
  source: string; connected: boolean; lastSyncAt: string | null;
  staleHours: number | null; status: 'ok' | 'stale' | 'error' | 'off'; note?: string; tokenDaysLeft?: number | null;
};
type Health = { items: HealthItem[]; problems: number; checkedAt: string };

const PRESETS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '3 месяца' },
];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function AnalyticsPage() {
  return <Suspense><AnalyticsContent /></Suspense>;
}

function AnalyticsContent() {
  const [days, setDays] = useState(30);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const token = readCookie('access_token');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [f, h] = await Promise.all([
        apiFetch<Funnel>(`/analytics/funnel?days=${days}&project=a-school`, { token }).catch(() => null),
        apiFetch<Health>('/analytics/health', { token }).catch(() => null),
      ]);
      if (f) setFunnel(f);
      if (h) setHealth(h);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const maxStage = Math.max(...(funnel?.stages.map((s) => s.value) ?? [1]), 1);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="size-6 text-primary" /> Аналитика продукта
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Сквозная воронка привлечения, юнит-экономика и мониторинг источников · Авторская школа
          </p>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${days === p.days ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Авто-сигналы */}
      {funnel && funnel.signals.length > 0 && (
        <section className="space-y-2">
          {funnel.signals.map((s, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm rounded-lg border px-4 py-2.5 ${
              s.level === 'danger' ? 'border-danger/30 bg-danger/5 text-danger'
              : s.level === 'warning' ? 'border-warning/30 bg-warning/5 text-warning'
              : 'border-success/30 bg-success/5 text-success'}`}>
              {s.level === 'danger' ? <XCircle className="size-4 mt-0.5 shrink-0" /> : s.level === 'warning' ? <AlertTriangle className="size-4 mt-0.5 shrink-0" /> : <TrendingUp className="size-4 mt-0.5 shrink-0" />}
              <span>{s.text}</span>
            </div>
          ))}
        </section>
      )}

      {/* Юнит-экономика с дельтой к прошлому периоду */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <EconCard icon={<DollarSign className="size-4" />} label="Выручка (продажи)" value={funnel ? `${formatNumber(funnel.revenue)} ₸` : '—'} delta={funnel?.deltas.revenue} loading={loading} />
        <EconCard icon={<TrendingUp className="size-4" />} label="Средний чек" value={funnel ? `${formatNumber(funnel.avgCheck)} ₸` : '—'} delta={funnel?.deltas.avgCheck} loading={loading} />
        <EconCard icon={<CheckCircle2 className="size-4" />} label="Конверсия лид→продажа" value={funnel?.leadToSale != null ? `${funnel.leadToSale}%` : '—'} loading={loading} />
        <EconCard icon={<Users className="size-4" />} label="Учеников в школе" value={funnel?.enrolledTotal != null ? formatNumber(funnel.enrolledTotal) : '—'} loading={loading} hint="kabinety · 2026/2027" />
      </section>

      {/* Сквозная воронка */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Воронка привлечения · {days} дней</h2>
        <p className="text-xs text-muted-foreground mb-3">Объёмы по этапам за период. Лиды и сделки — параллельные каналы входа; конверсия считается там, где это корректно.</p>
        <div className="border border-border rounded-xl bg-background p-5 space-y-3">
          {(funnel?.stages ?? []).map((s) => {
            const w = Math.max(4, Math.round((s.value / maxStage) * 100));
            return (
              <div key={s.key} className="flex items-center gap-4">
                <div className="w-40 shrink-0">
                  <div className="text-sm font-medium">{s.label}</div>
                  {s.note && <div className="text-[11px] text-muted-foreground leading-tight">{s.note}</div>}
                </div>
                <div className="flex-1 h-9 bg-muted/40 rounded-lg overflow-hidden relative">
                  <div className="h-full rounded-lg bg-primary/70 flex items-center px-3" style={{ width: `${w}%` }}>
                    <span className="text-sm font-semibold text-primary-foreground tabular-nums">{formatNumber(s.value)}</span>
                  </div>
                </div>
                <div className="w-24 text-right shrink-0">
                  {s.convFromPrev != null ? (
                    <span className="text-sm font-medium text-success tabular-nums">{s.convFromPrev}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Продажи по воронкам — откуда деньги */}
      {funnel && funnel.salesByFunnel.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Продажи по воронкам · {days} дней</h2>
          <div className="border border-border rounded-xl bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2">Воронка</th>
                  <th className="text-right px-3 py-2">Продаж</th>
                  <th className="text-right px-5 py-2">Выручка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {funnel.salesByFunnel.map((f) => (
                  <tr key={f.categoryId} className="hover:bg-muted/20">
                    <td className="px-5 py-2 font-medium">{f.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(f.count)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatNumber(f.revenue)} ₸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Панель здоровья */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">Здоровье данных</h2>
          {health && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${health.problems > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
              {health.problems > 0 ? `${health.problems} проблем` : 'всё в норме'}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Свежесть синков и срок жизни токенов — чтобы узнать о сбое заранее, а не когда «не робит».</p>
        <div className="border border-border rounded-xl bg-background divide-y divide-border overflow-hidden">
          {(health?.items ?? []).map((it, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <HealthDot status={it.status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{it.source}</div>
                {it.note && <div className="text-[11px] text-muted-foreground truncate">{it.note}</div>}
              </div>
              {it.tokenDaysLeft != null && (
                <div className={`text-xs tabular-nums ${it.tokenDaysLeft <= 7 ? 'text-danger' : it.tokenDaysLeft <= 21 ? 'text-warning' : 'text-muted-foreground'}`}>
                  токен: {it.tokenDaysLeft <= 0 ? 'истёк' : `${it.tokenDaysLeft} дн.`}
                </div>
              )}
              <div className="text-xs text-muted-foreground w-28 text-right shrink-0">
                {it.staleHours == null ? 'нет синка' : it.staleHours < 1 ? 'только что' : `${it.staleHours} ч назад`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EconCard({ icon, label, value, hint, delta, loading }: { icon: React.ReactNode; label: string; value: string; hint?: string; delta?: number | null; loading?: boolean }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs">{icon}{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={`text-2xl font-bold tabular-nums ${loading ? 'opacity-50' : ''}`}>{value}</div>
        {delta != null && delta !== 0 && (
          <span className={`text-xs font-medium ${delta > 0 ? 'text-success' : 'text-danger'}`}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
        : delta != null ? <div className="text-[11px] text-muted-foreground mt-1">к прошлому периоду</div> : null}
    </div>
  );
}

function HealthDot({ status }: { status: HealthItem['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="size-4 text-success shrink-0" />;
  if (status === 'stale') return <AlertTriangle className="size-4 text-warning shrink-0" />;
  if (status === 'error') return <XCircle className="size-4 text-danger shrink-0" />;
  return <Circle className="size-4 text-muted-foreground shrink-0" />;
}
