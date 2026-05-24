'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Megaphone, ExternalLink, AlertTriangle, TrendingUp, DollarSign,
  MousePointerClick, Target, BarChart3, ChevronRight, RefreshCw,
  Eye, Users, Zap, Phone, MessageCircle, FileText, Share2, ChevronDown,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '@/lib/api-client';

type MetaStatus = { configured: boolean; adAccountId: string | null; lastSyncAt: string | null };
type LeadBreakdown = { phone: number; messenger: number; form: number; social: number; total: number; period: string };

type AdInsights = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  frequency: number;
  leads: number;
  cpl: number;
  purchaseValue: number;
  roas: number;
  kztRate: number;
};

type Campaign = AdInsights & {
  id: string;
  name: string;
  status: string;
  objective?: string;
};

const DATE_PRESETS = [
  { value: 'last_7d', label: '7 дней' },
  { value: 'last_14d', label: '14 дней' },
  { value: 'last_28d', label: '28 дней' },
  { value: 'last_30d', label: '30 дней' },
  { value: 'last_90d', label: '90 дней' },
  { value: 'this_month', label: 'Этот месяц' },
  { value: 'last_month', label: 'Прошлый месяц' },
];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: decimals });
}

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${fmt(n / 1_000_000, 1)}М`;
  if (n >= 1_000) return `$${fmt(n / 1_000, 1)}K`;
  return `$${fmt(n, 2)}`;
}

function fmtKzt(n: number) {
  if (n >= 1_000_000) return `₸${fmt(n / 1_000_000, 1)}М`;
  if (n >= 1_000) return `₸${fmt(n / 1_000, 0)}K`;
  return `₸${fmt(n)}`;
}

function fmtBoth(usd: number, rate: number) {
  return `${fmtUsd(usd)} / ${fmtKzt(Math.round(usd * rate))}`;
}

export default function AdsPage() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [insights, setInsights] = useState<AdInsights | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [datePreset, setDatePreset] = useState('last_28d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadBreakdown | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const token = typeof document !== 'undefined' ? readCookie('access_token') : null;
  const router = useRouter();

  useEffect(() => {
    if (!token) return;
    apiFetch<MetaStatus>('/integrations/meta/status', { token })
      .then(setStatus)
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!status?.configured || !token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<AdInsights>(`/integrations/meta/ads/insights?datePreset=${datePreset}`, { token }),
      apiFetch<Campaign[]>(`/integrations/meta/ads/campaigns?datePreset=${datePreset}`, { token }),
    ])
      .then(([ins, camps]) => { setInsights(ins); setCampaigns(camps); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [status?.configured, datePreset, token]);

  useEffect(() => {
    if (!token) return;
    setLeadsLoading(true);
    apiFetch<LeadBreakdown>(`/integrations/yandex-metrica/leads?datePreset=${datePreset}`, { token })
      .then(setLeads)
      .catch(() => setLeads(null))
      .finally(() => setLeadsLoading(false));
  }, [datePreset, token]);

  if (!status?.configured) {
    return <NotConnectedView />;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Реклама (Meta Ads)</h1>
          <p className="text-sm text-muted-foreground">
            {status.adAccountId} · §8 ТЗ
            {status.lastSyncAt && (
              <span className="ml-2">· синк: {new Date(status.lastSyncAt).toLocaleString('ru-RU')}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`px-3 py-1.5 transition-colors ${datePreset === p.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {loading && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </header>

      {error && (
        <div className="border border-danger/40 bg-danger/5 rounded-xl p-4 text-sm text-danger flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="size-4" />} label="Расход" value={insights ? fmtBoth(insights.spend, insights.kztRate) : '—'} hint={insights?.impressions ? `${fmt(insights.impressions)} показов` : undefined} loading={loading} />
        <KpiCard icon={<MousePointerClick className="size-4" />} label="CTR" tooltip="Кликабельность — % пользователей, нажавших на объявление" value={insights ? `${fmt(insights.ctr, 2)}%` : '—'} hint={insights?.clicks ? `${fmt(insights.clicks)} кликов` : undefined} loading={loading} />
        <KpiCard icon={<Target className="size-4" />} label="CPL" tooltip="Стоимость лида — расход ÷ количество лидов" value={insights ? (insights.cpl > 0 ? fmtBoth(insights.cpl, insights.kztRate) : '—') : '—'} hint={insights?.leads ? `${fmt(insights.leads)} лидов` : 'нет данных'} loading={loading} />
        <KpiCard icon={<TrendingUp className="size-4" />} label="ROAS" tooltip="Возврат на рекламные расходы — доход от рекламы ÷ расход" value={insights ? (insights.roas > 0 ? `${fmt(insights.roas, 2)}x` : '—') : '—'} hint={insights?.purchaseValue ? fmtBoth(insights.purchaseValue, insights.kztRate) : undefined} loading={loading} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Eye className="size-4" />} label="Охват" value={insights ? fmt(insights.reach) : '—'} loading={loading} small />
        <KpiCard icon={<Zap className="size-4" />} label="Частота" tooltip="Среднее число показов одного объявления одному пользователю" value={insights ? fmt(insights.frequency, 2) : '—'} loading={loading} small />
        <KpiCard icon={<MousePointerClick className="size-4" />} label="CPC" tooltip="Стоимость клика — расход ÷ количество кликов" value={insights ? (insights.cpc > 0 ? fmtBoth(insights.cpc, insights.kztRate) : '—') : '—'} loading={loading} small />
        <KpiCard icon={<Users className="size-4" />} label="Лиды" value={insights ? fmt(insights.leads) : '—'} loading={loading} small />
      </div>

      {/* Campaign spend chart */}
      <CampaignSpendChart campaigns={campaigns} loading={loading} />

      {/* Yandex Metrica leads */}
      <YandexLeadsSection leads={leads} loading={leadsLoading} />

      {/* Campaigns table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Кампании</h2>
          <BarChart3 className="size-4 text-muted-foreground" />
        </div>
        {campaigns.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Кампаний не найдено за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-3">Кампания</th>
                  <th className="text-left p-3">Статус</th>
                  <th className="text-right p-3">Расход</th>
                  <th className="text-right p-3">Охват</th>
                  <th className="text-right p-3"><span title="Кликабельность — клики / показы × 100%">CTR ⓘ</span></th>
                  <th className="text-right p-3"><span title="Стоимость лида — расход ÷ лиды">CPL ⓘ</span></th>
                  <th className="text-right p-3"><span title="Возврат на рекламные расходы — доход ÷ расход">ROAS ⓘ</span></th>
                  <th className="p-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} onClick={() => router.push(`/ads/${c.id}?datePreset=${datePreset}`)} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="p-3 font-medium max-w-xs truncate">{c.name}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'active' ? 'bg-success/10 text-success' :
                        c.status === 'paused' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {c.status === 'active' ? 'Активна' : c.status === 'paused' ? 'Пауза' : c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.spend > 0 ? fmtBoth(c.spend, c.kztRate) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{c.reach > 0 ? fmt(c.reach) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={c.ctr >= 2 ? 'text-success' : c.ctr >= 1 ? 'text-warning' : c.ctr > 0 ? 'text-danger' : ''}>
                        {c.ctr > 0 ? `${fmt(c.ctr, 2)}%` : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{c.cpl > 0 ? fmtBoth(c.cpl, c.kztRate) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{c.roas > 0 ? `${fmt(c.roas, 2)}x` : '—'}</td>
                    <td className="p-3"><ChevronRight className="size-4 text-muted-foreground/40" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span><span className="text-success">●</span> CTR ≥ 2% — хороший</span>
        <span><span className="text-warning">●</span> CTR 1–2% — средний</span>
        <span><span className="text-danger">●</span> CTR &lt; 1% — слабый</span>
        <span className="ml-auto">Данные: Meta Marketing API · период: {DATE_PRESETS.find(p => p.value === datePreset)?.label}</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, hint, loading, small, tooltip,
}: {
  icon: React.ReactNode; label: string; value: string; hint?: string; loading?: boolean; small?: boolean; tooltip?: string;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2 text-xs">
        {icon}
        <span>{label}</span>
        {tooltip && <span title={tooltip} className="cursor-help text-muted-foreground/40 hover:text-muted-foreground transition-colors">ⓘ</span>}
      </div>
      <div className={`font-bold tabular-nums ${small ? 'text-xl' : 'text-2xl'} ${loading ? 'opacity-50' : ''}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function CampaignSpendChart({ campaigns, loading }: { campaigns: Campaign[]; loading: boolean }) {
  const data = [...campaigns]
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map((c) => ({ name: c.name.length > 30 ? c.name.slice(0, 30) + '…' : c.name, spend: Math.round(c.spend) }));

  if (data.length === 0 && !loading) return null;

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      <div className="font-semibold mb-4 text-sm">Расход по кампаниям</div>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 38, 80)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(v: number) => [fmtKzt(v), 'Расход']} />
            <Bar dataKey="spend" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" label={{ position: 'right', formatter: (v: number) => fmtKzt(v), fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function YandexLeadsSection({ leads, loading }: { leads: LeadBreakdown | null; loading: boolean }) {
  const [open, setOpen] = useState(true);

  if (loading) {
    return (
      <div className="border border-border rounded-xl bg-background p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="size-4 animate-spin" /> Загрузка данных Яндекс Метрики…
      </div>
    );
  }

  if (!leads || leads.total === 0) return null;

  const items = [
    { key: 'phone', label: 'Звонки', icon: <Phone className="size-4" />, value: leads.phone },
    { key: 'messenger', label: 'WhatsApp / мессенджер', icon: <MessageCircle className="size-4" />, value: leads.messenger },
    { key: 'form', label: 'Форма заявки', icon: <FileText className="size-4" />, value: leads.form },
    { key: 'social', label: 'Соцсети (Instagram)', icon: <Share2 className="size-4" />, value: leads.social },
  ].filter((i) => i.value > 0);

  return (
    <div className="border border-border rounded-xl bg-background overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="size-4 text-muted-foreground" />
          <span className="font-semibold">Лиды (Яндекс Метрика)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{leads.total}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {leads.period}
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {items.map((item) => {
            const pct = leads.total > 0 ? (item.value / leads.total) * 100 : 0;
            return (
              <div key={item.key} className="px-5 py-3 flex items-center gap-4">
                <div className="text-muted-foreground shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground w-10 text-right tabular-nums">{Math.round(pct)}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotConnectedView() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Реклама (Meta Ads)</h1>
          <p className="text-sm text-muted-foreground">Аналитика по платной рекламе — кампании, группы, объявления · §8 ТЗ</p>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Megaphone className="size-4" /> Подключить Meta Ads
        </Link>
      </header>

      <div className="border border-warning/40 bg-warning/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold mb-1">Meta Ads не подключён</div>
            <p className="text-sm text-muted-foreground mb-3">
              Для отображения данных нужен System User Access Token из Meta Business Suite.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>1. Откройте <span className="font-medium">Meta Business Suite → Настройки → Системные пользователи</span></div>
              <div>2. Создайте пользователя с правами на <span className="font-medium">Ads Manager</span> и страницы Instagram/Facebook</div>
              <div>3. Сгенерируйте токен и добавьте его в <Link href="/settings" className="text-primary hover:underline">Настройки → Meta Ads</Link></div>
            </div>
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
            >
              Открыть Meta Business Suite <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Preview (greyed out) */}
      <div>
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-[10px]">ПРЕДПРОСМОТР</span>
          Так будет выглядеть интерфейс после подключения
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-40 pointer-events-none select-none">
          <KpiCard icon={<DollarSign className="size-4" />} label="Расход" value="₸454K" />
          <KpiCard icon={<MousePointerClick className="size-4" />} label="CTR" value="2.4%" />
          <KpiCard icon={<Target className="size-4" />} label="CPL" value="₸3 200" />
          <KpiCard icon={<TrendingUp className="size-4" />} label="ROAS" value="3.1x" />
        </div>
      </div>
    </div>
  );
}
