'use client';

import { useState } from 'react';
import {
  Globe, ExternalLink, AlertTriangle, Users, MousePointerClick,
  TrendingUp, BarChart3, ArrowUpRight, Map,
} from 'lucide-react';

const MOCK_SOURCES = [
  { source: 'Organic Search', sessions: 8420, users: 6100, bounceRate: 42 },
  { source: 'Social (Instagram)', sessions: 5230, users: 4890, bounceRate: 38 },
  { source: 'Direct', sessions: 3100, users: 2900, bounceRate: 35 },
  { source: 'Referral (YouTube)', sessions: 2840, users: 2600, bounceRate: 31 },
  { source: 'Paid Search', sessions: 1920, users: 1780, bounceRate: 55 },
];

const MOCK_PAGES = [
  { path: '/club-program', views: 12400, avgTime: '2:34' },
  { path: '/a-school-main', views: 9800, avgTime: '1:48' },
  { path: '/ayaru-show', views: 7300, avgTime: '3:12' },
  { path: '/register', views: 4200, avgTime: '0:58' },
  { path: '/contacts', views: 2100, avgTime: '0:42' },
];

export default function TrafficPage() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Трафик сайтов</h1>
          <p className="text-sm text-muted-foreground">
            Google Analytics 4 — сессии, пользователи, источники, конверсии · §10 ТЗ
          </p>
        </div>
        <ConnectButton />
      </header>

      {/* Connection banner */}
      <div className="border border-warning/40 bg-warning/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold mb-1">Google Analytics 4 не подключён</div>
            <p className="text-sm text-muted-foreground mb-3">
              Нужен Service Account с доступом к GA4 Property и включённый Google Analytics Data API.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>1. <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" className="text-primary underline">Google Cloud Console</a> → создайте Service Account</div>
              <div>2. Включите <span className="font-medium">Google Analytics Data API</span></div>
              <div>3. Добавьте email Service Account в GA4 как «Читатель»</div>
              <div>4. Скачайте JSON-ключ и укажите в <span className="font-mono bg-muted px-1 rounded">.env</span>: <span className="font-mono">GA4_PROPERTY_ID</span> и <span className="font-mono">GA4_SERVICE_ACCOUNT_KEY</span></div>
            </div>
            <a
              href="https://analytics.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
            >
              Открыть Google Analytics <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      </div>

      {/* KPI preview */}
      <div>
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-[10px]">ПРЕДПРОСМОТР</span>
          Так будет выглядеть интерфейс после подключения
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 pointer-events-none select-none">
          <MetricCard icon={<Users className="size-4" />} label="Пользователи (28д)" value="24.5K" />
          <MetricCard icon={<Globe className="size-4" />} label="Сессии (28д)" value="38.2K" />
          <MetricCard icon={<MousePointerClick className="size-4" />} label="Конверсии" value="342" />
          <MetricCard icon={<TrendingUp className="size-4" />} label="Отказы" value="41%" />
        </div>
      </div>

      {/* Sources table preview */}
      <div className="border border-border rounded-xl overflow-hidden opacity-50 pointer-events-none select-none">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Источники трафика</h2>
          <BarChart3 className="size-4 text-muted-foreground" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-3">Источник</th>
              <th className="text-right p-3">Сессии</th>
              <th className="text-right p-3">Пользователи</th>
              <th className="text-right p-3">Отказы</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SOURCES.map((s, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{s.source}</td>
                <td className="p-3 text-right tabular-nums">{s.sessions.toLocaleString('ru-RU')}</td>
                <td className="p-3 text-right tabular-nums">{s.users.toLocaleString('ru-RU')}</td>
                <td className="p-3 text-right tabular-nums">{s.bounceRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top pages preview */}
      <div className="border border-border rounded-xl overflow-hidden opacity-50 pointer-events-none select-none">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Топ страниц</h2>
          <Map className="size-4 text-muted-foreground" />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-3">Страница</th>
              <th className="text-right p-3">Просмотры</th>
              <th className="text-right p-3">Сред. время</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAGES.map((p, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="p-3 font-mono text-xs">{p.path}</td>
                <td className="p-3 text-right tabular-nums">{p.views.toLocaleString('ru-RU')}</td>
                <td className="p-3 text-right">{p.avgTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: <Globe className="size-4" />, title: 'Органика vs платный трафик', desc: 'Разбивка: Organic, Paid, Direct, Social, Referral по каждому сайту (§10.1)' },
          { icon: <MousePointerClick className="size-4" />, title: 'Конверсионные действия', desc: 'Формы записи, клики WhatsApp, скачивания материалов (§10.2)' },
          { icon: <ArrowUpRight className="size-4" />, title: 'UTM-связка с публикациями', desc: 'Привязка трафика к конкретным постам и видео (§10.3)' },
          { icon: <Map className="size-4" />, title: 'География и устройства', desc: 'Карта и диаграмма по городам Казахстана + mobile vs desktop' },
        ].map((f, i) => (
          <div key={i} className="border border-border rounded-xl p-4 bg-background">
            <div className="flex items-center gap-2 text-primary mb-2">{f.icon}</div>
            <div className="font-semibold text-sm">{f.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ConnectButton() {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
      >
        <Globe className="size-4" /> Подключить GA4
      </button>
      {show && (
        <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 max-w-sm text-right">
          Подключение GA4 планируется в Этапе 5. Добавьте <code className="font-mono">GA4_PROPERTY_ID</code> и <code className="font-mono">GA4_SERVICE_ACCOUNT_KEY</code> в .env.
        </p>
      )}
    </div>
  );
}
