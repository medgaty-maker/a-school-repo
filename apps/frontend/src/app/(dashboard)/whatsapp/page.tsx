'use client';

import { useState } from 'react';
import {
  MessageSquare, ExternalLink, AlertTriangle, Clock, Users,
  TrendingUp, PhoneCall, CheckCircle2,
} from 'lucide-react';

const INTEGRATORS = [
  {
    name: 'Wazzup',
    desc: 'Наиболее распространён в СНГ. Поддерживает WhatsApp Business API и Instagram Direct.',
    url: 'https://wazzup24.com/',
    recommended: true,
  },
  {
    name: 'Salesbot',
    desc: 'Казахстанский сервис, хорошо интегрируется с amoCRM и Bitrix24.',
    url: 'https://salesbot.pro/',
    recommended: false,
  },
  {
    name: 'Chat2Desk',
    desc: 'Мультиканальная платформа: WhatsApp, Telegram, Instagram в одном интерфейсе.',
    url: 'https://chat2desk.com/',
    recommended: false,
  },
  {
    name: 'Twilio',
    desc: 'Американское API — гибко, но требует верификации WhatsApp Business Account (сложнее в РК).',
    url: 'https://www.twilio.com/',
    recommended: false,
  },
];

const MOCK_MANAGERS = [
  { name: 'Айгерим', incoming: 42, handled: 39, avgResponseMin: 4, converted: 12 },
  { name: 'Дана', incoming: 38, handled: 36, avgResponseMin: 7, converted: 9 },
  { name: 'Назгуль', incoming: 31, handled: 31, avgResponseMin: 3, converted: 14 },
];

const MOCK_SOURCES = [
  { source: 'Instagram Bio', dialogs: 48, pct: 34 },
  { source: 'Instagram Story', dialogs: 37, pct: 26 },
  { source: 'YouTube описание', dialogs: 28, pct: 20 },
  { source: 'Сайт / лендинг', dialogs: 19, pct: 13 },
  { source: 'Прочие', dialogs: 10, pct: 7 },
];

export default function WhatsAppPage() {
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Метаданные диалогов, источники лидов, нагрузка менеджеров · §11 ТЗ
          </p>
        </div>
      </header>

      {/* GDPR notice */}
      <div className="border border-border bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground">
        <span className="font-medium">Содержимое переписок не отображается</span> — только метаданные (источник, время ответа, этап).
        Соответствует GDPR и Закону РК «О персональных данных».
      </div>

      {/* Connection banner */}
      <div className="border border-warning/40 bg-warning/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-warning mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold mb-1">WhatsApp интеграция не настроена</div>
            <p className="text-sm text-muted-foreground mb-3">
              Выберите интегратора ниже и добавьте API-ключ в настройки. Интегратор предоставит webhook,
              который нужно зарегистрировать в WhatsApp Business Account.
            </p>
          </div>
        </div>
      </div>

      {/* Integrators */}
      <div>
        <h2 className="font-semibold mb-3">Выберите интегратора</h2>
        {connectMsg && (
          <div className="mb-3 text-sm text-muted-foreground bg-muted rounded-lg px-4 py-3">
            {connectMsg}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATORS.map((int) => (
            <div
              key={int.name}
              className={`border rounded-xl p-4 bg-background ${int.recommended ? 'border-primary/40' : 'border-border'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold flex items-center gap-2">
                  {int.name}
                  {int.recommended && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">Рекомендован</span>
                  )}
                </div>
                <a
                  href={int.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">{int.desc}</p>
              <button
                onClick={() => setConnectMsg(`Подключение ${int.name}: добавьте WHATSAPP_API_KEY в .env и перезапустите сервер.`)}
                className="mt-3 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Подключить
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview section */}
      <div>
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-[10px]">ПРЕДПРОСМОТР</span>
          После подключения вы увидите эти данные
        </div>

        <div className="space-y-4 opacity-50 pointer-events-none select-none">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={<MessageSquare className="size-4" />} label="Диалогов (28д)" value="142" />
            <MetricCard icon={<Clock className="size-4" />} label="Сред. ответ" value="5 мин" />
            <MetricCard icon={<CheckCircle2 className="size-4" />} label="Конверсия → лид" value="31%" />
            <MetricCard icon={<TrendingUp className="size-4" />} label="Конверсия → продажа" value="8%" />
          </div>

          {/* Managers table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Нагрузка по менеджерам</h2>
              <Users className="size-4 text-muted-foreground" />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-3">Менеджер</th>
                  <th className="text-right p-3">Входящих</th>
                  <th className="text-right p-3">Обработано</th>
                  <th className="text-right p-3">Сред. ответ</th>
                  <th className="text-right p-3">Конвертировано</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_MANAGERS.map((m, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3 text-right">{m.incoming}</td>
                    <td className="p-3 text-right">
                      <span className={m.handled === m.incoming ? 'text-success' : ''}>{m.handled}</span>
                    </td>
                    <td className="p-3 text-right">{m.avgResponseMin} мин</td>
                    <td className="p-3 text-right">{m.converted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sources */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Источники диалогов</h2>
              <PhoneCall className="size-4 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-3">
              {MOCK_SOURCES.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="text-sm w-40 shrink-0">{s.source}</div>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground w-16 text-right">
                    {s.dialogs} ({s.pct}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
