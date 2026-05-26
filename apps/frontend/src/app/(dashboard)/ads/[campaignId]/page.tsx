'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, X, BarChart2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

type AdInsights = {
  spend: number; impressions: number; clicks: number; reach: number;
  ctr: number; cpc: number; frequency: number; leads: number; cpl: number;
  purchaseValue: number; roas: number; kztRate: number;
};

type Ad = AdInsights & {
  id: string; name: string; status: string;
  thumbnailUrl?: string; creativeTitle?: string; creativeBody?: string;
};

const DATE_PRESETS = [
  { value: 'last_7d', label: '7 дней' },
  { value: 'last_14d', label: '14 дней' },
  { value: 'last_28d', label: '28 дней' },
  { value: 'last_30d', label: '30 дней' },
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

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId;

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState(searchParams.get('datePreset') ?? 'last_28d');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const token = typeof document !== 'undefined' ? readCookie('access_token') : null;

  useEffect(() => {
    if (!token || !campaignId) return;
    setLoading(true);
    setError(null);
    apiFetch<Ad[]>(`/integrations/meta/ads/campaigns/${campaignId}/ads?datePreset=${datePreset}`, { token })
      .then(setAds)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [campaignId, datePreset, token]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedAds = ads.filter((a) => selected.has(a.id));

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/ads" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Объявления кампании</h1>
            <p className="text-sm text-muted-foreground">ID: {campaignId}</p>
          </div>
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
          <AlertTriangle className="size-4 shrink-0" />{error}
        </div>
      )}

      {selected.size >= 2 && (
        <div className="flex items-center gap-3 border border-primary/30 bg-primary/5 rounded-xl px-4 py-3">
          <BarChart2 className="size-4 text-primary" />
          <span className="text-sm">Выбрано {selected.size} объявления</span>
          <button
            onClick={() => setComparing(true)}
            className="ml-auto px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Сравнить
          </button>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Объявления</h2>
          <span className="text-xs text-muted-foreground">{ads.length} шт.</span>
        </div>
        {ads.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Нет объявлений за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="p-3 w-8" />
                  <th className="text-left p-3">Объявление</th>
                  <th className="text-left p-3">Статус</th>
                  <th className="text-right p-3">Расход</th>
                  <th className="text-right p-3">Охват</th>
                  <th className="text-right p-3"><span title="Кликабельность">CTR ⓘ</span></th>
                  <th className="text-right p-3"><span title="Стоимость клика">CPC ⓘ</span></th>
                  <th className="text-right p-3"><span title="Стоимость лида">CPL ⓘ</span></th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.id} className={`border-b border-border last:border-0 transition-colors ${selected.has(ad.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(ad.id)}
                        onChange={() => toggleSelect(ad.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="flex items-center gap-3">
                        {ad.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ad.thumbnailUrl} alt=""
                            className="size-10 rounded object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            title="Нажмите для просмотра"
                            onClick={(e) => { e.stopPropagation(); setPreviewImg(ad.thumbnailUrl!); }}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{ad.name}</div>
                          {ad.creativeTitle && <div className="text-xs text-muted-foreground truncate">{ad.creativeTitle}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ad.status === 'active' ? 'bg-success/10 text-success' :
                        ad.status === 'paused' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {ad.status === 'active' ? 'Активно' : ad.status === 'paused' ? 'Пауза' : ad.status}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{ad.spend > 0 ? fmtBoth(ad.spend, ad.kztRate) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{ad.reach > 0 ? fmt(ad.reach) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">
                      <span className={ad.ctr >= 2 ? 'text-success' : ad.ctr >= 1 ? 'text-warning' : ad.ctr > 0 ? 'text-danger' : ''}>
                        {ad.ctr > 0 ? `${fmt(ad.ctr, 2)}%` : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">{ad.cpc > 0 ? fmtBoth(ad.cpc, ad.kztRate) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{ad.cpl > 0 ? fmtBoth(ad.cpl, ad.kztRate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {comparing && selectedAds.length >= 2 && (
        <CompareModal ads={selectedAds} onClose={() => setComparing(false)} />
      )}

      {previewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl leading-none"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImg} alt="Креатив" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}

function CompareModal({ ads, onClose }: { ads: Ad[]; onClose: () => void }) {
  const rate = ads[0]?.kztRate ?? 460;
  const metrics: Array<{ key: keyof Ad; label: string; fmt: (v: number) => string }> = [
    { key: 'spend', label: 'Расход', fmt: (v) => fmtBoth(v, rate) },
    { key: 'impressions', label: 'Показы', fmt: (v) => fmt(v) },
    { key: 'reach', label: 'Охват', fmt: (v) => fmt(v) },
    { key: 'clicks', label: 'Клики', fmt: (v) => fmt(v) },
    { key: 'ctr', label: 'CTR', fmt: (v) => `${fmt(v, 2)}%` },
    { key: 'cpc', label: 'CPC', fmt: (v) => fmtBoth(v, rate) },
    { key: 'leads', label: 'Лиды', fmt: (v) => fmt(v) },
    { key: 'cpl', label: 'CPL', fmt: (v) => fmtBoth(v, rate) },
    { key: 'roas', label: 'ROAS', fmt: (v) => `${fmt(v, 2)}x` },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-background">
          <h2 className="font-semibold">Сравнение объявлений</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground text-xs w-32">Метрика</th>
                {ads.map((ad) => (
                  <th key={ad.id} className="p-4 text-left">
                    <div className="flex items-center gap-2">
                      {ad.thumbnailUrl && <img src={ad.thumbnailUrl} alt="" className="size-8 rounded object-cover" />}
                      <div>
                        <div className="font-medium text-xs leading-tight max-w-[160px] truncate">{ad.name}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          ad.status === 'active' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}>
                          {ad.status === 'active' ? 'Активно' : 'Пауза'}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ key, label, fmt: fmtFn }) => {
                const values = ads.map((a) => a[key] as number);
                const max = Math.max(...values);
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="p-4 text-xs text-muted-foreground">{label}</td>
                    {ads.map((ad) => {
                      const v = ad[key] as number;
                      const isBest = v === max && max > 0 && ['spend', 'impressions', 'reach', 'clicks', 'leads', 'purchaseValue'].includes(key)
                        || (v === Math.min(...values) && Math.min(...values) > 0 && ['cpc', 'cpl'].includes(key))
                        || (v === max && max > 0 && ['ctr', 'roas'].includes(key));
                      return (
                        <td key={ad.id} className={`p-4 tabular-nums font-medium ${isBest ? 'text-success' : ''}`}>
                          {v > 0 ? fmtFn(v) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
