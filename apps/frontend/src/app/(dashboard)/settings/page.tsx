'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Plug, CheckCircle2, AlertCircle, XCircle, ChevronRight, RefreshCw, ExternalLink, Unplug, Megaphone, Instagram, BarChart2, Music2 } from 'lucide-react';

type Project = {
  id: string;
  slug: string;
  name: string;
  platforms: Array<{
    id: string;
    platform: string;
    status: string;
    externalAccountName: string | null;
    lastSyncAt: string | null;
  }>;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  ACTIVE: <CheckCircle2 className="size-4 text-success" />,
  EXPIRED: <AlertCircle className="size-4 text-warning" />,
  ERROR: <XCircle className="size-4 text-danger" />,
  NOT_CONNECTED: <Plug className="size-4 text-muted-foreground" />,
};

type SyncResult = { total: number; success: number; failed: number };
type BitrixStatus = { configured: boolean; lastSyncAt: string | null; totalDeals: number };
type MetaStatus = { configured: boolean; adAccountId: string | null; lastSyncAt: string | null };
type MetricaStatus = { id: string; counterIds: string; lastSyncAt: string | null } | null;
type TikTokStatus = { id?: string; openId?: string; displayName?: string | null; tokenExpiresAt?: string | null; lastSyncAt?: string | null; authUrl: string };

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [bitrix, setBitrix] = useState<BitrixStatus | null>(null);
  const [bitrixUrl, setBitrixUrl] = useState('');
  const [bitrixSaving, setBitrixSaving] = useState(false);
  const [bitrixMsg, setBitrixMsg] = useState<string | null>(null);

  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [metaTesting, setMetaTesting] = useState(false);
  const [oauthMsg, setOauthMsg] = useState<string | null>(null);
  const [igManualId, setIgManualId] = useState<string | null>(null);
  const [igManualToken, setIgManualToken] = useState('');
  const [igManualSaving, setIgManualSaving] = useState(false);
  const [igManualError, setIgManualError] = useState<string | null>(null);

  const [metrica, setMetrica] = useState<MetricaStatus>(null);
  const [metricaToken, setMetricaToken] = useState('');
  const [metricaCounterIds, setMetricaCounterIds] = useState('');
  const [metricaSaving, setMetricaSaving] = useState(false);
  const [metricaMsg, setMetricaMsg] = useState<string | null>(null);

  const [tiktok, setTiktok] = useState<TikTokStatus | null>(null);
  const [tiktokMsg, setTiktokMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();

  function refresh() {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<Project[]>('/projects', { token }).then(setProjects).catch(console.error);
    apiFetch<BitrixStatus>('/bitrix/status', { token }).then(setBitrix).catch(console.error);
    apiFetch<MetaStatus>('/integrations/meta/status', { token }).then(setMeta).catch(console.error);
    apiFetch<MetricaStatus>('/integrations/yandex-metrica/config', { token }).then(setMetrica).catch(console.error);
    apiFetch<TikTokStatus>('/integrations/tiktok/config', { token }).then(setTiktok).catch(() => setTiktok(null));
  }

  useEffect(() => {
    refresh();

    // Handle OAuth redirect params
    const igStatus = searchParams.get('instagram');
    const igUsername = searchParams.get('username');
    const igError = searchParams.get('msg');
    const ytStatus = searchParams.get('youtube');
    const ytChannel = searchParams.get('channel');

    const tiktokStatus = searchParams.get('tiktok');

    if (igStatus === 'ok' && igUsername) {
      setOauthMsg(`Instagram @${igUsername} успешно подключён!`);
    } else if (igStatus === 'error') {
      setOauthMsg(`Ошибка подключения Instagram: ${igError ?? 'неизвестная ошибка'}`);
    } else if (ytStatus === 'ok' && ytChannel) {
      setOauthMsg(`YouTube «${ytChannel}» успешно подключён!`);
    } else if (tiktokStatus === 'connected') {
      setTiktokMsg('TikTok успешно подключён!');
      refresh();
    } else if (tiktokStatus === 'error') {
      setTiktokMsg('Ошибка подключения TikTok. Попробуйте снова.');
    }
  }, []);

  async function saveBitrixUrl(e: FormEvent) {
    e.preventDefault();
    const token = readCookie('access_token');
    if (!token || !bitrixUrl.trim()) return;
    setBitrixSaving(true);
    setBitrixMsg(null);
    try {
      await apiFetch('/bitrix/config', { method: 'PUT', token, body: JSON.stringify({ url: bitrixUrl.trim() }) });
      setBitrixMsg('Сохранено. Запускаем синхронизацию…');
      const r = await apiFetch<{ synced: number }>('/bitrix/sync', { method: 'POST', token });
      setBitrixMsg(`Готово: синхронизировано ${r.synced} сделок.`);
      setBitrixUrl('');
      refresh();
    } catch (e) {
      setBitrixMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBitrixSaving(false);
    }
  }

  async function saveMetaConfig(e: FormEvent) {
    e.preventDefault();
    const token = readCookie('access_token');
    if (!token || !metaToken.trim() || !metaAccountId.trim()) return;
    setMetaSaving(true);
    setMetaMsg(null);
    try {
      await apiFetch('/integrations/meta/config', {
        method: 'PUT',
        token,
        body: JSON.stringify({ accessToken: metaToken.trim(), adAccountId: metaAccountId.trim() }),
      });
      setMetaMsg('Сохранено. Проверьте подключение кнопкой «Тест».');
      setMetaToken('');
      setMetaAccountId('');
      refresh();
    } catch (e) {
      setMetaMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setMetaSaving(false);
    }
  }

  async function testMetaConnection() {
    const token = readCookie('access_token');
    if (!token) return;
    setMetaTesting(true);
    setMetaMsg(null);
    try {
      const r = await apiFetch<{ ok: boolean; name?: string; error?: string }>('/integrations/meta/test', { method: 'POST', token });
      setMetaMsg(r.ok ? `Подключение успешно: ${r.name ?? 'System User'}` : `Ошибка токена: ${r.error}`);
    } catch (e) {
      setMetaMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setMetaTesting(false);
    }
  }

  async function disconnectMeta() {
    if (!confirm('Отключить Meta Ads?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch('/integrations/meta/config', { method: 'DELETE', token });
      setMetaMsg(null);
      refresh();
    } catch (e) {
      setMetaMsg(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function saveMetricaConfig(e: FormEvent) {
    e.preventDefault();
    const token = readCookie('access_token');
    if (!token || !metricaToken.trim() || !metricaCounterIds.trim()) return;
    setMetricaSaving(true);
    setMetricaMsg(null);
    try {
      await apiFetch('/integrations/yandex-metrica/config', {
        method: 'POST',
        token,
        body: JSON.stringify({ token: metricaToken.trim(), counterIds: metricaCounterIds.trim() }),
      });
      setMetricaMsg('Сохранено.');
      setMetricaToken('');
      setMetricaCounterIds('');
      refresh();
    } catch (e) {
      setMetricaMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setMetricaSaving(false);
    }
  }

  function connectTikTok() {
    const clientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI;
    if (!clientKey || !redirectUri) {
      setTiktokMsg('TikTok не настроен. Обратитесь к администратору.');
      return;
    }
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: 'user.info.basic,user.info.stats,video.list',
      redirect_uri: redirectUri,
      state: 'tiktok_oauth',
    });
    window.location.href = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  async function disconnectTikTok() {
    if (!confirm('Отключить TikTok?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch('/integrations/tiktok/disconnect', { method: 'DELETE', token });
      setTiktok(null);
      setTiktokMsg(null);
    } catch (e) {
      setTiktokMsg(`Ошибка: ${(e as Error).message}`);
    }
  }

  function startYouTubeOAuth(projectPlatformId: string) {
    const token = readCookie('access_token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    window.location.href = `${apiBase}/api/integrations/youtube/oauth/start/${projectPlatformId}?bearer=${token}`;
  }

  async function startInstagramOAuth(projectPlatformId: string) {
    const token = readCookie('access_token');
    if (!token) return;
    try {
      const r = await apiFetch<{ url: string }>(
        `/integrations/meta/instagram/oauth/url/${projectPlatformId}`,
        { token },
      );
      window.location.href = r.url;
    } catch (e) {
      setOauthMsg(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function saveInstagramTokenManually(projectPlatformId: string) {
    const token = readCookie('access_token');
    if (!token) {
      setIgManualError('Сессия истекла — обновите страницу');
      return;
    }
    if (!igManualToken.trim()) {
      setIgManualError('Вставьте токен');
      return;
    }
    setIgManualSaving(true);
    setIgManualError(null);
    try {
      const r = await apiFetch<{ username: string }>(
        `/integrations/meta/instagram/${projectPlatformId}/token`,
        { method: 'POST', token, body: JSON.stringify({ accessToken: igManualToken.trim() }) },
      );
      setOauthMsg(`Instagram @${r.username} успешно подключён!`);
      setIgManualId(null);
      setIgManualToken('');
      setIgManualError(null);
      refresh();
    } catch (e) {
      setIgManualError(`Ошибка: ${(e as Error).message}`);
    } finally {
      setIgManualSaving(false);
    }
  }

  async function disconnectInstagramPlatform(projectPlatformId: string) {
    if (!confirm('Отключить Instagram от этого проекта?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/integrations/meta/instagram/oauth/${projectPlatformId}`, { method: 'DELETE', token });
      refresh();
    } catch (e) {
      setOauthMsg(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function disconnectYouTube(projectPlatformId: string) {
    if (!confirm('Отключить YouTube-канал от этого проекта?')) return;
    const token = readCookie('access_token');
    if (!token) return;
    try {
      await apiFetch(`/integrations/youtube/oauth/${projectPlatformId}`, { method: 'DELETE', token });
      refresh();
    } catch (e) {
      setOauthMsg(`Ошибка: ${(e as Error).message}`);
    }
  }

  async function runSync() {
    const token = readCookie('access_token');
    if (!token) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await apiFetch<SyncResult>('/snapshots/run', {
        method: 'POST',
        token,
      });
      setSyncResult(result);
      refresh(); // обновим lastSyncAt
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">
          Подключения API, проекты, пользователи, цели, UTM-конструктор (§14 ТЗ).
          В Этапе 1 реализовано: подключение YouTube для каждого проекта. Остальное — Этапы 2–6.
        </p>
      </header>

      {oauthMsg && (
        <div className={`border rounded-xl p-4 text-sm flex items-center gap-2 ${
          oauthMsg.startsWith('Ошибка')
            ? 'border-danger/40 bg-danger/5 text-danger'
            : 'border-success/40 bg-success/5 text-success'
        }`}>
          {oauthMsg.startsWith('Ошибка') ? <XCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
          {oauthMsg}
          <button onClick={() => setOauthMsg(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      <section className="border border-border rounded-xl bg-background p-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="font-semibold">Синхронизация данных</div>
          <div className="text-xs text-muted-foreground">
            Cron автоматически синкает раз в 6 часов. Можно запустить вручную.
          </div>
          {syncResult && (
            <div className="text-xs mt-2 text-success">
              Готово: {syncResult.success} из {syncResult.total} платформ синхронизировано
              {syncResult.failed > 0 ? `, ${syncResult.failed} упало (см. логи в БД).` : '.'}
            </div>
          )}
          {syncError && <div className="text-xs mt-2 text-danger">{syncError}</div>}
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизация…' : 'Синхронизировать сейчас'}
        </button>
      </section>

      {/* Bitrix24 */}
      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-3">
          <div className="font-semibold">Bitrix24 — CRM</div>
          {bitrix?.configured ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Подключён</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Не настроен</span>
          )}
          {bitrix?.lastSyncAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Последний синк: {new Date(bitrix.lastSyncAt).toLocaleString('ru-RU')} · {bitrix.totalDeals} сделок
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Для подключения создайте <strong>Входящий вебхук</strong> в Bitrix24 с правами <code className="bg-muted px-1 rounded text-xs">CRM (read)</code> и вставьте URL ниже.{' '}
            <a
              href="https://a-school.bitrix24.kz/devops/section/incomingwebhooks/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              Открыть Bitrix24 <ExternalLink className="size-3" />
            </a>
          </p>
          <form onSubmit={saveBitrixUrl} className="flex gap-2">
            <input
              type="url"
              required
              value={bitrixUrl}
              onChange={(e) => setBitrixUrl(e.target.value)}
              placeholder="https://a-school.bitrix24.kz/rest/1/xxxxxxxx/"
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={bitrixSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {bitrixSaving ? 'Сохранение…' : bitrix?.configured ? 'Обновить' : 'Подключить'}
            </button>
          </form>
          {bitrixMsg && (
            <p className={`text-sm ${bitrixMsg.startsWith('Ошибка') ? 'text-danger' : 'text-success'}`}>
              {bitrixMsg}
            </p>
          )}
        </div>
      </section>

      {/* Meta Ads */}
      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-3">
          <Megaphone className="size-4 text-muted-foreground" />
          <div className="font-semibold">Meta Ads — Facebook & Instagram</div>
          {meta?.configured ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Подключён</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Не настроен</span>
          )}
          {meta?.adAccountId && (
            <span className="text-xs text-muted-foreground ml-auto">
              {meta.adAccountId}
              {meta.lastSyncAt ? ` · синк: ${new Date(meta.lastSyncAt).toLocaleString('ru-RU')}` : ''}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Создайте <strong>Системного пользователя</strong> в Meta Business Suite с правами на Ads Manager,
            сгенерируйте <strong>System User Access Token</strong> и введите <strong>ID рекламного кабинета</strong> (без «act_»).{' '}
            <a
              href="https://business.facebook.com/settings/system-users"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              Открыть Meta Business Suite <ExternalLink className="size-3" />
            </a>
          </p>
          <form onSubmit={saveMetaConfig} className="space-y-2">
            <input
              type="text"
              required
              value={metaToken}
              onChange={(e) => setMetaToken(e.target.value)}
              placeholder="System User Access Token"
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                placeholder="ID рекламного кабинета (например: 123456789)"
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={metaSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 whitespace-nowrap"
              >
                {metaSaving ? 'Сохранение…' : meta?.configured ? 'Обновить' : 'Подключить'}
              </button>
            </div>
          </form>
          {meta?.configured && (
            <div className="flex gap-2">
              <button
                onClick={testMetaConnection}
                disabled={metaTesting}
                className="px-3 py-1.5 border border-border rounded-md text-xs hover:bg-muted transition-colors disabled:opacity-50"
              >
                {metaTesting ? 'Проверяем…' : 'Тест подключения'}
              </button>
              <button
                onClick={disconnectMeta}
                className="px-3 py-1.5 border border-danger/40 text-danger rounded-md text-xs hover:bg-danger/10 transition-colors"
              >
                Отключить
              </button>
            </div>
          )}
          {metaMsg && (
            <p className={`text-sm ${metaMsg.startsWith('Ошибка') || metaMsg.startsWith('Ошибка') ? 'text-danger' : 'text-success'}`}>
              {metaMsg}
            </p>
          )}
        </div>
      </section>

      {/* Yandex Metrica */}
      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-3">
          <BarChart2 className="size-4 text-muted-foreground" />
          <div className="font-semibold">Яндекс Метрика — цели и лиды</div>
          {metrica ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Подключена</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Не настроена</span>
          )}
          {metrica?.lastSyncAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Последний синк: {new Date(metrica.lastSyncAt).toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          {metrica && (
            <div className="text-sm text-muted-foreground">
              Счётчики: <span className="text-foreground font-mono">{metrica.counterIds}</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Введите OAuth-токен Яндекс.Метрики и ID счётчика (можно несколько через запятую).
          </p>
          <form onSubmit={saveMetricaConfig} className="space-y-2">
            <input
              type="text"
              required
              value={metricaToken}
              onChange={(e) => setMetricaToken(e.target.value)}
              placeholder="OAuth-токен y0_..."
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={metricaCounterIds}
                onChange={(e) => setMetricaCounterIds(e.target.value)}
                placeholder="ID счётчика (например: 105849697)"
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={metricaSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 whitespace-nowrap"
              >
                {metricaSaving ? 'Сохранение…' : metrica ? 'Обновить' : 'Подключить'}
              </button>
            </div>
          </form>
          {metricaMsg && (
            <p className={`text-sm ${metricaMsg.startsWith('Ошибка') ? 'text-danger' : 'text-success'}`}>
              {metricaMsg}
            </p>
          )}
        </div>
      </section>

      {/* TikTok */}
      <section className="border border-border rounded-xl bg-background overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-3">
          <Music2 className="size-4 text-muted-foreground" />
          <div className="font-semibold">TikTok — Parents Club</div>
          {tiktok?.id ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">Подключён</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Не подключён</span>
          )}
          {tiktok?.lastSyncAt && (
            <span className="text-xs text-muted-foreground ml-auto">
              Последний синк: {new Date(tiktok.lastSyncAt!).toLocaleString('ru-RU')}
            </span>
          )}
        </div>
        <div className="p-5 space-y-3">
          {tiktok?.id ? (
            <div className="space-y-3">
              <div className="text-sm">
                Аккаунт: <span className="font-medium">{tiktok.displayName ?? tiktok.openId ?? '—'}</span>
              </div>
              <button
                onClick={disconnectTikTok}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-danger border border-danger/30 rounded-md hover:bg-danger/5"
              >
                <Unplug className="size-3.5" /> Отключить
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Подключите TikTok аккаунт Parents Club через OAuth для просмотра статистики.
              </p>
              <button
                onClick={connectTikTok}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              >
                <Music2 className="size-4" /> Подключить TikTok
              </button>
            </div>
          )}
          {tiktokMsg && (
            <p className={`text-sm ${tiktokMsg.startsWith('Ошибка') ? 'text-danger' : 'text-success'}`}>
              {tiktokMsg}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Подключения платформ</h2>
        <div className="space-y-4">
          {projects.map((p) => (
            <div key={p.id} className="border border-border rounded-xl bg-background overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/40">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">/{p.slug}</div>
              </div>
              <div className="divide-y divide-border">
                {p.platforms.map((pp) => (
                  <div key={pp.id} className="px-5 py-3 flex items-center gap-3">
                    {STATUS_ICON[pp.status]}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{pp.platform}</div>
                      <div className="text-xs text-muted-foreground">
                        {pp.externalAccountName ?? 'не подключено'}
                        {pp.lastSyncAt
                          ? ` · последний синк: ${new Date(pp.lastSyncAt).toLocaleString('ru-RU')}`
                          : ''}
                      </div>
                    </div>
                    {pp.platform === 'YOUTUBE' ? (
                      <div className="flex items-center gap-2">
                        {pp.status === 'ACTIVE' && (
                          <button
                            onClick={() => disconnectYouTube(pp.id)}
                            className="text-xs px-3 py-1.5 border border-danger/40 text-danger rounded-md flex items-center gap-1 hover:bg-danger/10 transition-colors"
                          >
                            <Unplug className="size-3" /> Отключить
                          </button>
                        )}
                        <button
                          onClick={() => startYouTubeOAuth(pp.id)}
                          className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md flex items-center gap-1"
                        >
                          {pp.status === 'ACTIVE' ? 'Переподключить' : 'Подключить'}
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    ) : pp.platform === 'INSTAGRAM' ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {pp.status === 'ACTIVE' && (
                            <button
                              onClick={() => disconnectInstagramPlatform(pp.id)}
                              className="text-xs px-3 py-1.5 border border-danger/40 text-danger rounded-md flex items-center gap-1 hover:bg-danger/10 transition-colors"
                            >
                              <Unplug className="size-3" /> Отключить
                            </button>
                          )}
                          <button
                            onClick={() => setIgManualId(igManualId === pp.id ? null : pp.id)}
                            className="text-xs px-3 py-1.5 border border-border rounded-md flex items-center gap-1 hover:bg-muted transition-colors"
                          >
                            <Instagram className="size-3" />
                            Вставить токен
                          </button>
                          <button
                            onClick={() => startInstagramOAuth(pp.id)}
                            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md flex items-center gap-1"
                          >
                            <Instagram className="size-3" />
                            {pp.status === 'ACTIVE' ? 'Переподключить' : 'Подключить Instagram'}
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                        {igManualId === pp.id && (
                          <div className="flex flex-col gap-1 w-full max-w-sm">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={igManualToken}
                                onChange={(e) => { setIgManualToken(e.target.value); setIgManualError(null); }}
                                placeholder="Instagram Access Token"
                                className="flex-1 px-2 py-1.5 border border-border rounded-md text-xs bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button
                                onClick={() => saveInstagramTokenManually(pp.id)}
                                disabled={igManualSaving}
                                className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 whitespace-nowrap"
                              >
                                {igManualSaving ? 'Сохранение…' : 'Сохранить'}
                              </button>
                            </div>
                            {igManualError && (
                              <p className="text-xs text-danger">{igManualError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Этап 2</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SourceMappingSection />

      <section className="border border-border rounded-xl p-5 bg-background space-y-2">
        <div className="font-semibold">Остальные подсекции «Настроек»</div>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Управление пользователями и правами (§14.3) — Этап 6 (RBAC уже есть в API)</li>
          <li>• Настройка целей и алертов (§14.4) — Этап 6</li>
          <li>• UTM-конструктор (§14.5) — Этап 5</li>
          <li>• Логи синхронизаций (§14.1) — частично доступно через `GET /api/audit-log`</li>
        </ul>
      </section>
    </div>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function splitIds(s?: string | null): string[] {
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

type MapProject = {
  id: string; slug: string; name: string;
  bitrixCategoryIds: string | null;
  metricaCounterIds: string | null;
  metaCampaignIds: string | null;
};
type BitrixCategory = { categoryId: string; categoryName: string | null; count: number };
type MetaCampaign = { id: string; name: string };
type Sel = { bitrix: Set<string>; metrica: Set<string>; meta: Set<string> };

function Chips({ options, selected, onToggle }: {
  options: Array<{ id: string; label: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return <span className="text-xs text-muted-foreground italic">нет вариантов</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
            selected.has(o.id)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Привязка источников (Bitrix воронки / Метрика счётчики / Meta кампании) к проектам
function SourceMappingSection() {
  const [projects, setProjects] = useState<MapProject[]>([]);
  const [categories, setCategories] = useState<BitrixCategory[]>([]);
  const [counters, setCounters] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = readCookie('access_token');
    if (!token) return;
    apiFetch<MapProject[]>('/projects', { token }).then((ps) => {
      setProjects(ps);
      const init: Record<string, Sel> = {};
      for (const p of ps) {
        init[p.slug] = {
          bitrix: new Set(splitIds(p.bitrixCategoryIds)),
          metrica: new Set(splitIds(p.metricaCounterIds)),
          meta: new Set(splitIds(p.metaCampaignIds)),
        };
      }
      setSel(init);
    }).catch(() => {});
    apiFetch<BitrixCategory[]>('/bitrix/categories', { token }).then(setCategories).catch(() => {});
    apiFetch<{ counterIds?: string } | null>('/integrations/yandex-metrica/config', { token })
      .then((c) => setCounters(splitIds(c?.counterIds))).catch(() => {});
    apiFetch<Array<{ id: string | number; name: string }>>('/integrations/meta/ads/campaigns?datePreset=last_28d', { token })
      .then((cs) => setCampaigns(cs.map((c) => ({ id: String(c.id), name: c.name })))).catch(() => {});
  }, []);

  const toggle = (slug: string, group: keyof Sel, id: string) => {
    setSel((prev) => {
      const cur = prev[slug] ?? { bitrix: new Set<string>(), metrica: new Set<string>(), meta: new Set<string>() };
      const next: Sel = { bitrix: new Set(cur.bitrix), metrica: new Set(cur.metrica), meta: new Set(cur.meta) };
      if (next[group].has(id)) next[group].delete(id); else next[group].add(id);
      return { ...prev, [slug]: next };
    });
  };

  const save = async (slug: string) => {
    const token = readCookie('access_token');
    const s = sel[slug];
    if (!token || !s) return;
    setSaving(slug); setMsg(null);
    try {
      await apiFetch(`/projects/${slug}/sources`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          bitrixCategoryIds: [...s.bitrix].join(','),
          metricaCounterIds: [...s.metrica].join(','),
          metaCampaignIds: [...s.meta].join(','),
        }),
      });
      setMsg(`✓ Сохранено: ${slug}`);
    } catch (e) {
      setMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="border border-border rounded-xl bg-background overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="font-semibold">Привязка источников к проектам</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Какие воронки Bitrix, счётчики Метрики и кампании Meta относятся к проекту. Влияет на Лиды/Записи/Продажи на странице проекта. Пусто = нет данных по источнику (покажет 0).
        </p>
        {msg && <p className="text-xs mt-2 text-foreground">{msg}</p>}
      </div>
      {projects.map((p) => {
        const s = sel[p.slug] ?? { bitrix: new Set<string>(), metrica: new Set<string>(), meta: new Set<string>() };
        return (
          <div key={p.id} className="border-b border-border last:border-0 px-5 py-4 space-y-3">
            <div className="font-medium text-sm">{p.name} <span className="text-xs text-muted-foreground">/{p.slug}</span></div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Воронки Bitrix</div>
              <Chips options={categories.map((c) => ({ id: c.categoryId, label: `${c.categoryName ?? c.categoryId} (${c.count})` }))} selected={s.bitrix} onToggle={(id) => toggle(p.slug, 'bitrix', id)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Счётчики Метрики</div>
              <Chips options={counters.map((c) => ({ id: c, label: c }))} selected={s.metrica} onToggle={(id) => toggle(p.slug, 'metrica', id)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Кампании Meta</div>
              <Chips options={campaigns.map((c) => ({ id: c.id, label: c.name }))} selected={s.meta} onToggle={(id) => toggle(p.slug, 'meta', id)} />
            </div>
            <button
              type="button"
              onClick={() => save(p.slug)}
              disabled={saving === p.slug}
              className="text-xs px-4 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving === p.slug ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        );
      })}
    </section>
  );
}
