'use client';

import { Suspense } from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, TrendingUp, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { KpiCard } from '@/components/kpi-card';
import { DonutChart } from '@/components/widgets/donut-chart';
import { usePeriod, PERIODS } from '@/lib/use-period';
import { formatNumber } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type FunnelStage = {
  stageId: string;
  stageName: string;
  count: number;
  amount: number;
  isWon: boolean;
  isLost: boolean;
};

type FunnelData = {
  stages: FunnelStage[];
  summary: {
    total: number;
    won: number;
    lost: number;
    inProgress: number;
    conversionRate: number;
    totalAmount: number;
  };
};

type SourceData = {
  source: string;
  count: number;
  won: number;
  amount: number;
  conversionRate: number;
};

type Deal = {
  bitrixId: number;
  title: string;
  stageId: string;
  stageName: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  opportunity: string | null;
  currencyId: string | null;
  isWon: boolean;
  isLost: boolean;
  dateCreate: string;
};

type Status = { configured: boolean; lastSyncAt: string | null; totalDeals: number };
type StageBreakdown = { stageId: string; stageName: string; count: number; won: number; lost: number };
type StagesBreakdownData = { total: number; stages: StageBreakdown[] };
type PipelineStage = { stageName: string; count: number; percent: number; isWon: boolean; isLost: boolean };
type PipelineStagesData = { total: number; stages: PipelineStage[] };

type LeadsSummary = {
  presets: Record<string, number>;
  custom: { from: string; to: string; count: number } | null;
  total: number;
};
type SalesFunnelStage = { stageId: string; stageName: string; count: number; isWon: boolean; isLost: boolean };
type SalesFunnel = { categoryId: string; name: string; total: number; newInPeriod: number; stages: SalesFunnelStage[] };
type SalesFunnelsData = { period: { from: string; to: string }; funnels: SalesFunnel[] };

const LEAD_PRESETS: { key: string; label: string }[] = [
  { key: '7d', label: '7 дней' },
  { key: '14d', label: '14 дней' },
  { key: '28d', label: '28 дней' },
  { key: '31d', label: '31 день' },
  { key: '90d', label: '3 месяца' },
  { key: '180d', label: '6 месяцев' },
];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const STAGE_COLOR = (stage: { isWon: boolean; isLost: boolean }) => {
  if (stage.isWon) return 'hsl(142 71% 45%)';
  if (stage.isLost) return 'hsl(0 84% 60%)';
  return 'hsl(221 83% 53%)';
};

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const { period } = usePeriod();
  const days = PERIODS.find((p) => p.value === period)?.days ?? 30;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  const [status, setStatus] = useState<Status | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stagesBreakdown, setStagesBreakdown] = useState<StagesBreakdownData | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStagesData | null>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [pipelineStagesOpen, setPipelineStagesOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Блоки «Лиды» / «Сделки» (Bitrix доработки) с ручным диапазоном дат
  const [leadsSummary, setLeadsSummary] = useState<LeadsSummary | null>(null);
  const [salesFunnels, setSalesFunnels] = useState<SalesFunnelsData | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
  const [openFunnel, setOpenFunnel] = useState<string | null>(null);

  const token = readCookie('access_token');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rangeQs = appliedRange ? `?from=${appliedRange.from}&to=${appliedRange.to}` : '';
      const [s, f, src, d, sb, ps, ls, sf] = await Promise.all([
        apiFetch<Status>('/bitrix/status', { token }),
        apiFetch<FunnelData>(`/bitrix/funnel?days=${days}`, { token }),
        apiFetch<SourceData[]>(`/bitrix/sources?days=${days}`, { token }),
        apiFetch<Deal[]>(`/bitrix/deals?days=${days}&limit=20`, { token }),
        apiFetch<StagesBreakdownData>(`/bitrix/stages-breakdown?days=${days}`, { token }),
        apiFetch<PipelineStagesData>('/bitrix/pipeline-stages?days=90', { token }).catch(() => null),
        apiFetch<LeadsSummary>(`/bitrix/leads-summary${rangeQs}`, { token }).catch(() => null),
        apiFetch<SalesFunnelsData>(`/bitrix/sales-funnels${rangeQs}`, { token }).catch(() => null),
      ]);
      setStatus(s);
      setFunnel(f);
      setSources(src);
      setDeals(d);
      setStagesBreakdown(sb);
      if (ps) setPipelineStages(ps);
      if (ls) setLeadsSummary(ls);
      if (sf) setSalesFunnels(sf);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, days, appliedRange]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (!token || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await apiFetch<{ started: boolean; running: boolean }>('/bitrix/sync', {
        method: 'POST',
        token,
      });
      setSyncMsg(
        r.started
          ? 'Синхронизация запущена в фоне. Сделки появятся через 1–3 минуты — обновите страницу.'
          : 'Синхронизация уже идёт. Обновите страницу через пару минут.',
      );
    } catch (e) {
      setSyncMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Воронка: показываем только топ-12 стадий по числу сделок (у Bitrix их десятки
  // по всем направлениям — полный список делал страницу в десятки экранов).
  const topFunnelStages = (funnel?.stages ?? [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    // только нужные поля: если оставить amount (суммы), recharts берёт его в
    // домен оси значений и бары count'а становятся почти невидимыми
    .map((s) => ({
      stageId: s.stageId,
      stageName: s.stageName?.replace(/^C\d+:/i, '') ?? s.stageId,
      count: s.count,
      isWon: s.isWon,
      isLost: s.isLost,
    }));

  const notConfigured = status && !status.configured;

  if (notConfigured) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold mb-4">Лиды и продажи</h1>
        <div className="border border-border rounded-xl p-6 bg-background space-y-4">
          <p className="text-sm font-medium">Bitrix24 не подключён</p>
          <p className="text-sm text-muted-foreground">
            Чтобы видеть воронку лидов, выполните следующие шаги:
          </p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Откройте Bitrix24 → <strong>Приложения → Вебхуки → Входящий вебхук</strong></li>
            <li>
              Выдайте права: <code className="bg-muted px-1 rounded text-xs">crm</code> (read)
            </li>
            <li>
              Скопируйте URL вида{' '}
              <code className="bg-muted px-1 rounded text-xs">
                https://company.bitrix24.ru/rest/1/xxxx/
              </code>
            </li>
            <li>
              Выполните в терминале:{' '}
              <code className="bg-muted px-1 rounded text-xs block mt-1">
                cd apps/backend && npx ts-node prisma/import-bitrix.ts &lt;URL&gt;
              </code>
            </li>
            <li>Нажмите «Синхронизировать» на этой странице</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Лиды и продажи</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Воронка из Bitrix24 · {periodLabel}
            {status?.lastSyncAt && (
              <> · синхронизировано {new Date(status.lastSyncAt).toLocaleString('ru-RU')}</>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизация…' : 'Синхронизировать'}
        </button>
      </header>

      {syncMsg && (
        <div className="text-sm px-4 py-2 rounded-lg bg-muted">{syncMsg}</div>
      )}

      {/* Ручной диапазон дат — общий для блоков «Лиды» и «Сделки» */}
      <section className="border border-border rounded-xl bg-background p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">С</label>
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">По</label>
          <input
            type="date"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background"
          />
        </div>
        <button
          onClick={() => rangeFrom && rangeTo && setAppliedRange({ from: rangeFrom, to: rangeTo })}
          disabled={!rangeFrom || !rangeTo}
          className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Применить
        </button>
        {appliedRange && (
          <button
            onClick={() => { setAppliedRange(null); setRangeFrom(''); setRangeTo(''); }}
            className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
          >
            Сбросить
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {appliedRange
            ? `Период: ${appliedRange.from} → ${appliedRange.to}`
            : 'Сделки: «новых» считаются за последние 28 дней'}
        </span>
      </section>

      {/* Блок 1: Лиды (новые crm.lead) по периодам */}
      <section className="border border-border rounded-xl bg-background p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-semibold">Лиды (новые)</h2>
          <span className="text-xs text-muted-foreground">всего в базе: {formatNumber(leadsSummary?.total ?? 0)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {LEAD_PRESETS.map((p) => (
            <div key={p.key} className="rounded-lg border border-border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums">
                {leadsSummary ? formatNumber(leadsSummary.presets[p.key] ?? 0) : '…'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.label}</div>
            </div>
          ))}
        </div>
        {leadsSummary?.custom && (
          <div className="mt-3 rounded-lg bg-primary/10 text-primary p-3 text-sm">
            За выбранный период ({leadsSummary.custom.from} → {leadsSummary.custom.to}):{' '}
            <strong>{formatNumber(leadsSummary.custom.count)}</strong> новых лидов
          </div>
        )}
      </section>

      {/* Блок 2: Сделки — 6 воронок продаж, каждая отдельно + drill-down */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Сделки по воронкам</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(salesFunnels?.funnels ?? []).map((fn) => (
            <div key={fn.categoryId} className="border border-border rounded-xl bg-background overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{fn.name}</span>
                  <span className="text-xs text-muted-foreground">всего: {formatNumber(fn.total)}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums text-primary">{formatNumber(fn.newInPeriod)}</span>
                  <span className="text-xs text-muted-foreground">новых за период</span>
                </div>
              </div>
              <button
                onClick={() => setOpenFunnel((v) => (v === fn.categoryId ? null : fn.categoryId))}
                className="w-full px-5 py-2 border-t border-border flex items-center justify-between text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="text-muted-foreground">Детализация по статусам</span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${openFunnel === fn.categoryId ? 'rotate-180' : ''}`} />
              </button>
              {openFunnel === fn.categoryId && (
                <div className="border-t border-border divide-y divide-border">
                  {fn.stages.length === 0 ? (
                    <div className="px-5 py-3 text-sm text-muted-foreground">Нет сделок</div>
                  ) : (
                    fn.stages.map((s) => (
                      <div key={s.stageId} className="px-5 py-2 flex items-center justify-between text-sm">
                        <span className={s.isWon ? 'text-success' : s.isLost ? 'text-danger' : ''}>
                          {s.stageName}{s.isWon && ' ✅'}{s.isLost && ' ✕'}
                        </span>
                        <span className="font-semibold tabular-nums">{formatNumber(s.count)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Всего сделок"
          value={funnel?.summary.total ?? null}
          pending={loading}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Успешных"
          value={funnel?.summary.won ?? null}
          pending={loading}
          icon={<CheckCircle className="size-4" />}
          status="good"
        />
        <KpiCard
          label="Конверсия"
          value={funnel ? `${funnel.summary.conversionRate}%` : null}
          pending={loading}
          icon={<TrendingUp className="size-4" />}
          status={
            funnel
              ? funnel.summary.conversionRate >= 20
                ? 'good'
                : funnel.summary.conversionRate >= 10
                  ? 'warn'
                  : 'bad'
              : 'neutral'
          }
        />
        <KpiCard
          label="Закрыто (сумма)"
          value={funnel?.summary.totalAmount ?? null}
          unit="₸"
          pending={loading}
          icon={<XCircle className="size-4" />}
        />
      </section>

      {/* Funnel chart */}
      <section>
        <div className="border border-border rounded-xl bg-background p-5">
          <h2 className="font-semibold mb-1">Воронка по этапам · {periodLabel}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Топ-12 стадий по числу сделок{funnel && funnel.stages.length > 12 ? ` (из ${funnel.stages.length})` : ''}
          </p>
          {!funnel || funnel.stages.length === 0 ? (
            <div className="h-48 grid place-items-center text-sm text-muted-foreground">
              Нет данных за выбранный период
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.min(Math.max(300, topFunnelStages.length * 44), 580)}>
              <BarChart
                data={topFunnelStages}
                layout="vertical"
                margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
              >
                <XAxis type="number" dataKey="count" domain={[0, 'dataMax']} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="stageName"
                  width={170}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [formatNumber(v), 'Сделок']}
                  contentStyle={{ fontSize: 13, borderRadius: 8 }}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28} label={{ position: 'right', fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}>
                  {topFunnelStages.map((s, i) => (
                    <Cell key={i} fill={STAGE_COLOR(s)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Sources + Deals */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutChart
          title="Источники лидов"
          data={sources.map((s) => ({ name: s.source, value: s.count }))}
          emptyMessage="Нет данных об источниках. Убедитесь, что UTM-метки проставлены."
        />

        <div className="border border-border rounded-xl bg-background p-5">
          <h2 className="font-semibold mb-3">Источники → конверсия</h2>
          {sources.length === 0 ? (
            <div className="h-48 grid place-items-center text-sm text-muted-foreground text-center">
              Нет данных
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left pb-2">Источник</th>
                  <th className="text-right pb-2">Лидов</th>
                  <th className="text-right pb-2">Закрыто</th>
                  <th className="text-right pb-2">Конверсия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td className="py-1.5 font-medium">{s.source}</td>
                    <td className="text-right py-1.5">{formatNumber(s.count)}</td>
                    <td className="text-right py-1.5 text-success">{formatNumber(s.won)}</td>
                    <td className="text-right py-1.5">{s.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Deals table */}
      {deals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Последние сделки · {periodLabel}</h2>
          <div className="border border-border rounded-xl bg-background overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Сделка</th>
                  <th className="text-left px-3 py-2">Этап</th>
                  <th className="text-left px-3 py-2">Источник</th>
                  <th className="text-right px-3 py-2">Сумма</th>
                  <th className="text-right px-4 py-2">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deals.map((d) => (
                  <tr key={d.bitrixId} className="hover:bg-muted/20">
                    <td className="px-4 py-2 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 rounded-full flex-shrink-0 ${
                            d.isWon
                              ? 'bg-success'
                              : d.isLost
                                ? 'bg-danger'
                                : 'bg-primary'
                          }`}
                        />
                        <span className="truncate">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {d.stageName ?? d.stageId}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {d.utmSource ?? '—'}
                      {d.utmCampaign && (
                        <span className="text-muted-foreground"> / {d.utmCampaign}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {d.opportunity
                        ? `${formatNumber(Math.round(Number(d.opportunity)))} ${d.currencyId ?? ''}`
                        : '—'}
                    </td>
                    <td className="text-right px-4 py-2 text-xs text-muted-foreground">
                      {new Date(d.dateCreate).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pipeline stages breakdown (Резерв, Продажа, Набор в 1 класс) */}
      {pipelineStages && pipelineStages.total > 0 && (
        <section className="border border-border rounded-xl bg-background overflow-hidden">
          <button
            onClick={() => setPipelineStagesOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold">Лиды по стадиям</span>
              <span className="text-xs text-muted-foreground">воронки: Резерв, Продажа, Набор в 1 класс</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Всего: {pipelineStages.total}</span>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${pipelineStagesOpen ? 'rotate-180' : ''}`} />
          </button>
          {pipelineStagesOpen && (
            <div className="border-t border-border divide-y divide-border">
              {pipelineStages.stages.map((s) => {
                const nearWon = !s.isWon && !s.isLost && /договор|взнос/i.test(s.stageName);
                return (
                  <div key={s.stageName} className="px-5 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${s.isWon ? 'text-success' : s.isLost ? 'text-danger' : nearWon ? 'text-success/80' : ''}`}>
                        {s.stageName}
                        {s.isWon && ' ✅'}
                        {nearWon && ' 🔜'}
                      </span>
                      <div className="flex items-center gap-3 text-sm tabular-nums">
                        <span className="text-muted-foreground text-xs">{s.percent}%</span>
                        <span className="font-semibold">{s.count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.isWon || nearWon ? 'bg-success' : s.isLost ? 'bg-danger' : 'bg-primary'}`}
                        style={{ width: `${s.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
