import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Platform, IntegrationStatus, IntegrationCallStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';

const META_API_BASE = 'https://graph.facebook.com/v19.0';

// Instagram Business Login scopes (без Facebook, через api.instagram.com)
const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
].join(',');

const IG_API_BASE = 'https://graph.instagram.com/v22.0';

// --- Ads API types ---

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaInsightsRaw {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpp?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

interface MetaCampaignRaw {
  id: string;
  name: string;
  status: string;
  objective?: string;
  insights?: { data: MetaInsightsRaw[] };
}

export interface AdInsightsSummary {
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
}

export interface CampaignWithInsights extends AdInsightsSummary {
  id: string;
  name: string;
  status: string;
  objective?: string;
}

export interface AdWithCreative extends AdInsightsSummary {
  id: string;
  name: string;
  status: string;
  thumbnailUrl?: string;
  creativeTitle?: string;
  creativeBody?: string;
}

// --- Instagram types ---

export interface IgProfile {
  igUserId: string;
  username: string;
  name: string;
  followersCount: number;
  mediaCount: number;
  biography: string;
  profilePictureUrl: string;
}

export interface IgInsights {
  reach: number;
  impressions: number;
  profileViews: number;
  followersCount: number;
}

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly insightsCache = new Map<string, { data: unknown; fetchedAt: number }>();
  private readonly CACHE_TTL = 30 * 60 * 1000;
  private cachedKztRate: number = parseFloat(process.env.USD_TO_KZT_RATE ?? '460');
  private kztRateFetchedAt = 0;
  private readonly RATE_TTL = 60 * 60 * 1000; // 1 hour

  private async getKztRate(): Promise<number> {
    if (Date.now() - this.kztRateFetchedAt < this.RATE_TTL) return this.cachedKztRate;
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json() as { rates?: Record<string, number> };
        const rate = data?.rates?.KZT;
        if (rate && rate > 0) {
          this.cachedKztRate = rate;
          this.kztRateFetchedAt = Date.now();
        }
      }
    } catch {
      // fallback to cached/env value
    }
    return this.cachedKztRate;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ─── Meta Ads (System User Token) ───────────────────────────────────────────

  async getConfig() {
    const config = await this.prisma.metaConfig.findFirst();
    if (!config) return null;
    try {
      return {
        adAccountId: config.adAccountId,
        accessToken: this.crypto.decrypt(config.accessTokenEnc),
        appId: config.appId,
        lastSyncAt: config.lastSyncAt,
      };
    } catch {
      return null;
    }
  }

  private async exchangeForLongLivedToken(shortToken: string): Promise<string> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return shortToken;
    try {
      const url = `${META_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
      const res = await fetch(url);
      if (!res.ok) return shortToken;
      const data = await res.json() as { access_token?: string };
      return data.access_token ?? shortToken;
    } catch {
      return shortToken;
    }
  }

  async setConfig(accessToken: string, adAccountId: string, appId?: string) {
    const longToken = await this.exchangeForLongLivedToken(accessToken.trim());
    const accessTokenEnc = this.crypto.encrypt(longToken);
    const adAccountIdNorm = adAccountId.trim().startsWith('act_')
      ? adAccountId.trim()
      : `act_${adAccountId.trim()}`;

    const existing = await this.prisma.metaConfig.findFirst();
    if (existing) {
      return this.prisma.metaConfig.update({
        where: { id: existing.id },
        data: { accessTokenEnc, adAccountId: adAccountIdNorm, appId: appId ?? null },
      });
    }
    return this.prisma.metaConfig.create({
      data: { accessTokenEnc, adAccountId: adAccountIdNorm, appId: appId ?? null },
    });
  }

  async deleteConfig() {
    return this.prisma.metaConfig.deleteMany();
  }

  async getStatus() {
    const config = await this.prisma.metaConfig.findFirst();
    if (!config) return { configured: false, adAccountId: null, lastSyncAt: null };
    return {
      configured: true,
      adAccountId: config.adAccountId,
      appId: config.appId,
      lastSyncAt: config.lastSyncAt,
    };
  }

  async testConnection(): Promise<{ ok: boolean; name?: string; error?: string }> {
    const cfg = await this.getConfig();
    if (!cfg) return { ok: false, error: 'Not configured' };
    try {
      const res = await fetch(`${META_API_BASE}/me?fields=name&access_token=${cfg.accessToken}`);
      const data = (await res.json()) as { name?: string; error?: { message: string } };
      if (data.error) return { ok: false, error: data.error.message };
      return { ok: true, name: data.name };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async getAdInsights(datePreset = 'last_28d'): Promise<AdInsightsSummary> {
    const cacheKey = `insights:${datePreset}`;
    const cached = this.insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return cached.data as AdInsightsSummary;
    }

    await this.getKztRate();
    const cfg = await this.getConfig();
    if (!cfg) throw new BadRequestException('Meta Ads not configured');

    const fields = 'spend,impressions,clicks,ctr,cpc,cpp,reach,frequency,actions,action_values';
    const url = `${META_API_BASE}/${cfg.adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${cfg.accessToken}`;

    const res = await fetch(url);
    const json = (await res.json()) as { data?: MetaInsightsRaw[]; error?: { message: string } };

    if (json.error) throw new BadRequestException(`Meta API: ${json.error.message}`);

    const raw = json.data?.[0];
    const result = raw ? this.parseInsights(raw) : this.emptyInsights();

    this.insightsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    await this.prisma.metaConfig.updateMany({ data: { lastSyncAt: new Date() } });

    return result;
  }

  async getInsightsDaily(datePreset = 'last_28d'): Promise<Array<{ date: string; impressions: number; spend: number; leads: number }>> {
    const cfg = await this.getConfig();
    if (!cfg) return [];
    const url = `${META_API_BASE}/${cfg.adAccountId}/insights?fields=impressions,spend,actions&date_preset=${datePreset}&time_increment=1&access_token=${cfg.accessToken}`;
    const res = await fetch(url);
    const json = (await res.json()) as { data?: any[]; error?: any };
    if (json.error) return [];
    return (json.data ?? []).map((d: any) => {
      const actions: Array<{ action_type: string; value: string }> = d.actions ?? [];
      const leads = actions
        .filter((a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
        .reduce((sum, a) => sum + Number(a.value ?? 0), 0);
      return {
        date: String(d.date_start),
        impressions: Number(d.impressions ?? 0),
        spend: Number(d.spend ?? 0),
        leads: Math.round(leads),
      };
    });
  }

  async getCampaigns(datePreset = 'last_28d'): Promise<CampaignWithInsights[]> {
    const cfg = await this.getConfig();
    if (!cfg) throw new BadRequestException('Meta Ads not configured');

    const fields = `name,status,objective,insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,cpc,actions,action_values,reach}`;
    const url = `${META_API_BASE}/${cfg.adAccountId}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${cfg.accessToken}`;

    const res = await fetch(url);
    const json = (await res.json()) as { data?: MetaCampaignRaw[]; error?: { message: string } };

    if (json.error) throw new BadRequestException(`Meta API: ${json.error.message}`);

    return (json.data ?? []).map((c) => {
      const insights = c.insights?.data?.[0];
      const parsed = insights ? this.parseInsights(insights) : this.emptyInsights();
      return { id: c.id, name: c.name, status: c.status.toLowerCase(), objective: c.objective, ...parsed };
    });
  }

  async getCampaignAds(campaignId: string, datePreset = 'last_28d'): Promise<AdWithCreative[]> {
    const cfg = await this.getConfig();
    if (!cfg) throw new BadRequestException('Meta Ads not configured');

    const fields = `name,status,creative{thumbnail_url,title,body},insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,cpc,actions,action_values,reach}`;
    const url = `${META_API_BASE}/${campaignId}/ads?fields=${encodeURIComponent(fields)}&limit=100&access_token=${cfg.accessToken}`;

    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Array<{
        id: string; name: string; status: string;
        creative?: { thumbnail_url?: string; title?: string; body?: string };
        insights?: { data: MetaInsightsRaw[] };
      }>;
      error?: { message: string };
    };

    if (json.error) throw new BadRequestException(`Meta API: ${json.error.message}`);

    return (json.data ?? []).map((ad) => {
      const insights = ad.insights?.data?.[0];
      const parsed = insights ? this.parseInsights(insights) : this.emptyInsights();
      return {
        id: ad.id,
        name: ad.name,
        status: ad.status.toLowerCase(),
        thumbnailUrl: ad.creative?.thumbnail_url,
        creativeTitle: ad.creative?.title,
        creativeBody: ad.creative?.body,
        ...parsed,
      };
    });
  }

  // ─── Instagram OAuth ─────────────────────────────────────────────────────────

  buildInstagramAuthUrl(projectPlatformId: string): string {
    const appId = this.requireEnv('META_IG_APP_ID');
    const redirect = this.requireEnv('META_OAUTH_REDIRECT');
    // Instagram Business Login — пользователь вводит Instagram-логин, не Facebook
    const url = new URL('https://api.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('scope', IG_SCOPES);
    url.searchParams.set('state', projectPlatformId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('enable_profile_selector', 'true');
    return url.toString();
  }

  async handleInstagramCallback(
    code: string,
    state: string,
  ): Promise<{ projectPlatformId: string; username: string; igUserId: string }> {
    const pp = await this.prisma.projectPlatform.findUnique({
      where: { id: state },
      include: { project: { select: { name: true } } },
    });
    if (!pp || pp.platform !== Platform.INSTAGRAM) {
      throw new BadRequestException('Invalid OAuth state');
    }

    // 1. Exchange code → Instagram token; response includes user_id directly
    const shortToken = await this.exchangeCode(code);

    // 2. user_id comes from code exchange; username from /me if available
    const igUserId = shortToken.user_id || '';
    if (!igUserId) {
      throw new BadRequestException('Instagram OAuth did not return user_id');
    }

    // 3. Fetch username via /{user_id} (instagram_business_basic doesn't support /me)
    let username = igUserId;
    try {
      const uRes = await fetch(`${IG_API_BASE}/${igUserId}?fields=id,username&access_token=${encodeURIComponent(shortToken.access_token)}`);
      const uData = (await uRes.json()) as { id?: string; username?: string };
      this.logger.log(`IG user lookup: ${JSON.stringify(uData).slice(0, 200)}`);
      if (uData.username) username = uData.username;
    } catch {
      this.logger.warn('Could not fetch IG username, using user_id as name');
    }

    // 4. Обмениваем короткоживущий токен (~1 час) на долгоживущий (60 дней).
    // Без этого токен умирает в тот же день, а статус остаётся ACTIVE.
    let finalToken = shortToken.access_token;
    let expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    try {
      const ll = await this.exchangeForLongLived(shortToken.access_token);
      finalToken = ll.access_token;
      if (ll.expires_in) expiresAt = new Date(Date.now() + ll.expires_in * 1000);
      this.logger.log(`IG long-lived токен получен, expires_in=${ll.expires_in ?? 'n/a'}`);
    } catch (e) {
      this.logger.warn(`IG long-lived обмен не удался, сохраняю короткий токен: ${(e as Error).message}`);
    }

    await this.prisma.projectPlatform.update({
      where: { id: pp.id },
      data: {
        externalAccountId: igUserId,
        externalAccountName: username,
        accessTokenEnc: this.crypto.encrypt(finalToken),
        tokenExpiresAt: expiresAt,
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
    });

    this.logger.log(`Instagram connected for project ${pp.project.name}: @${username}`);

    return { projectPlatformId: pp.id, username, igUserId };
  }

  async saveInstagramTokenManually(projectPlatformId: string, accessToken: string): Promise<{ username: string; igUserId: string }> {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || pp.platform !== Platform.INSTAGRAM) throw new NotFoundException('Not found');

    // Валидируем токен через debug_token или /me
    let igUserId: string;
    let username: string;

    try {
      // Try Facebook Graph API (EAA... tokens from Business Login)
      let res = await fetch(`${META_API_BASE}/me?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`);
      let data = (await res.json()) as { id?: string; username?: string; name?: string; error?: { message: string; code?: number } };

      // Fallback: Instagram Graph API (IGAA... tokens from Instagram Business Login or Basic Display)
      if (data.error) {
        this.logger.log(`Facebook /me failed (${data.error.message}), trying graph.instagram.com...`);
        res = await fetch(`https://graph.instagram.com/v22.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
        data = (await res.json()) as { id?: string; username?: string; name?: string; error?: { message: string; code?: number } };
      }

      if (data.error) {
        this.logger.warn(`Token validation failed: ${data.error.message} (code ${data.error.code})`);
        throw new BadRequestException(`Недействительный токен: ${data.error.message}`);
      }
      if (!data.id) {
        throw new BadRequestException('Не удалось получить ID из токена');
      }

      igUserId = data.id;
      username = data.username ?? data.name ?? igUserId;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка при проверке токена: ${(e as Error).message}`);
    }

    await this.prisma.projectPlatform.update({
      where: { id: projectPlatformId },
      data: {
        externalAccountId: igUserId,
        externalAccountName: username,
        accessTokenEnc: this.crypto.encrypt(accessToken),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
    });

    return { username, igUserId };
  }

  async disconnectInstagram(projectPlatformId: string) {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || pp.platform !== Platform.INSTAGRAM) throw new NotFoundException('Not found');

    await this.prisma.projectPlatform.update({
      where: { id: projectPlatformId },
      data: {
        externalAccountId: null,
        externalAccountName: null,
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        status: IntegrationStatus.NOT_CONNECTED,
        lastError: null,
      },
    });
  }

  async getInstagramProfile(projectPlatformId: string): Promise<IgProfile> {
    const token = await this.getIgToken(projectPlatformId);
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.externalAccountId) throw new BadRequestException('Instagram not connected');

    const fields = 'name,username,biography,followers_count,media_count,profile_picture_url';
    const encodedToken = encodeURIComponent(token);
    let res = await fetch(`${META_API_BASE}/${pp.externalAccountId}?fields=${fields}&access_token=${encodedToken}`);
    let data = (await res.json()) as {
      id?: string; name?: string; username?: string; biography?: string;
      followers_count?: number; media_count?: number; profile_picture_url?: string;
      error?: { message: string };
    };

    // Fallback to graph.instagram.com for IGAA tokens
    if (data.error) {
      res = await fetch(`https://graph.instagram.com/v22.0/${pp.externalAccountId}?fields=${fields}&access_token=${encodedToken}`);
      data = (await res.json()) as typeof data;
    }

    if (data.error) throw new BadRequestException(`Instagram API: ${data.error.message}`);

    return {
      igUserId: pp.externalAccountId,
      username: data.username ?? '',
      name: data.name ?? '',
      followersCount: data.followers_count ?? 0,
      mediaCount: data.media_count ?? 0,
      biography: data.biography ?? '',
      profilePictureUrl: data.profile_picture_url ?? '',
    };
  }

  async getInstagramInsights(projectPlatformId: string): Promise<IgInsights> {
    const token = await this.getIgToken(projectPlatformId);
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.externalAccountId) throw new BadRequestException('Instagram not connected');

    const igId = pp.externalAccountId;

    const encodedToken = encodeURIComponent(token);
    const metricsRes = await fetch(
      `${IG_API_BASE}/${igId}/insights?metric=reach,accounts_engaged,profile_views,website_clicks&period=days_28&metric_type=total_value&access_token=${encodedToken}`,
    );
    const metricsJson = (await metricsRes.json()) as {
      data?: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>;
      error?: { message: string };
    };

    if (metricsJson.error) {
      throw new BadRequestException(`Instagram Insights: ${metricsJson.error.message}`);
    }

    const findMetric = (name: string) => {
      const m = (metricsJson.data ?? []).find((d) => d.name === name);
      if (!m) return 0;
      if (m.total_value?.value != null) return m.total_value.value;
      return (m.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
    };

    const profileRes = await fetch(
      `${IG_API_BASE}/${igId}?fields=followers_count&access_token=${encodedToken}`,
    );
    const profileJson = (await profileRes.json()) as { followers_count?: number };

    return {
      reach: findMetric('reach'),
      impressions: findMetric('accounts_engaged'),
      profileViews: findMetric('profile_views'),
      followersCount: profileJson.followers_count ?? 0,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async getIgToken(projectPlatformId: string): Promise<string> {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || pp.platform !== Platform.INSTAGRAM || pp.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Instagram not connected');
    }
    if (!pp.accessTokenEnc) throw new BadRequestException('No token stored');
    try {
      return this.crypto.decrypt(pp.accessTokenEnc);
    } catch {
      throw new BadRequestException('Token decryption failed');
    }
  }

  // Instagram Business Login — обмен кода на короткий IGAA токен
  private async exchangeCode(code: string): Promise<{ access_token: string; user_id?: string }> {
    const appId = this.requireEnv('META_IG_APP_ID');
    const appSecret = this.requireEnv('META_IG_APP_SECRET');
    const redirect = this.requireEnv('META_OAUTH_REDIRECT');

    const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirect, code, grant_type: 'authorization_code' });
    const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: params });
    const data = (await res.json()) as { access_token?: string; user_id?: string; error?: { message: string } };
    this.logger.log(`IG code exchange response: ${JSON.stringify({ ...data, access_token: data.access_token?.slice(0, 12) })}`);
    if (data.error || !data.access_token) {
      throw new BadRequestException(`Instagram token exchange failed: ${data.error?.message ?? 'no token'}`);
    }
    return { access_token: data.access_token, user_id: String(data.user_id ?? '') };
  }

  // Instagram Business Login — долгосрочный токен (60 дней) через graph.instagram.com.
  // Эндпоинт ig_exchange_token — это GET с query-параметрами.
  private async exchangeForLongLived(shortToken: string): Promise<{ access_token: string; expires_in?: number }> {
    const appSecret = this.requireEnv('META_IG_APP_SECRET');

    const url = new URL(`${IG_API_BASE}/access_token`);
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('access_token', shortToken);

    const res = await fetch(url.toString());
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (data.error || !data.access_token) {
      throw new BadRequestException(`Instagram long-lived token exchange failed: ${data.error?.message ?? 'no token'}`);
    }
    return { access_token: data.access_token, expires_in: data.expires_in };
  }

  private requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new BadRequestException(`Missing env var: ${key}`);
    return val;
  }

  private parseInsights(raw: MetaInsightsRaw): AdInsightsSummary {
    const spend = parseFloat(raw.spend ?? '0');
    const impressions = parseInt(raw.impressions ?? '0', 10);
    const clicks = parseInt(raw.clicks ?? '0', 10);
    const reach = parseInt(raw.reach ?? '0', 10);
    const ctr = parseFloat(raw.ctr ?? '0');
    const cpc = parseFloat(raw.cpc ?? '0');
    const frequency = parseFloat(raw.frequency ?? '0');

    const leads = this.extractAction(raw.actions, [
      'lead',
      'onsite_conversion.lead_grouped',
      'offsite_conversion.fb_pixel_lead',
    ]);
    const purchaseValue = this.extractActionValue(raw.action_values, [
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
    ]);

    const cpl = leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0;
    const roas = spend > 0 ? Math.round((purchaseValue / spend) * 100) / 100 : 0;
    const kztRate = this.cachedKztRate;

    return { spend, impressions, clicks, reach, ctr, cpc, frequency, leads, cpl, purchaseValue, roas, kztRate };
  }

  private emptyInsights(): AdInsightsSummary {
    return { spend: 0, impressions: 0, clicks: 0, reach: 0, ctr: 0, cpc: 0, frequency: 0, leads: 0, cpl: 0, purchaseValue: 0, roas: 0, kztRate: this.cachedKztRate };
  }

  private extractAction(actions: MetaAction[] | undefined, types: string[]): number {
    if (!actions) return 0;
    return actions.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + parseInt(a.value, 10), 0);
  }

  private extractActionValue(actionValues: MetaAction[] | undefined, types: string[]): number {
    if (!actionValues) return 0;
    return actionValues.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + parseFloat(a.value), 0);
  }

  // ─── Instagram Snapshot ──────────────────────────────────────────────────────

  async captureInstagramSnapshot(projectPlatformId: string): Promise<void> {
    const start = Date.now();
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || !pp.externalAccountId || !pp.accessTokenEnc) {
      throw new Error('Instagram not connected');
    }

    const token = this.crypto.decrypt(pp.accessTokenEnc);
    const encodedToken = encodeURIComponent(token);
    const igId = pp.externalAccountId;

    // Fetch followers count via graph.instagram.com
    let followersCount = 0;
    try {
      const profRes = await fetch(`${IG_API_BASE}/${igId}?fields=followers_count&access_token=${encodedToken}`);
      const profJson = (await profRes.json()) as { followers_count?: number; error?: unknown };
      followersCount = profJson.followers_count ?? 0;
    } catch {
      this.logger.warn(`Instagram [${pp.id}]: could not fetch followers`);
    }

    // Fetch insights via graph.instagram.com (работает с Instagram Business Login токенами)
    // period=days_28 без metric_type=total_value → values[] содержит rolling 28d агрегаты,
    // берём последнее значение (= текущий 28-дневный итог, как в приложении Instagram)
    let reach = 0, accountsEngaged = 0, profileViews = 0, websiteClicks = 0, totalInteractions = 0, impressions28d = 0;

    // Helper: last value of a rolling-28d time-series (no metric_type=total_value)
    const lastVal = (data: Array<{ name: string; values?: Array<{ value: number }> }>, name: string) => {
      const m = data.find((d) => d.name === name);
      if (!m?.values?.length) return 0;
      return m.values[m.values.length - 1].value ?? 0;
    };

    // Helper: total_value for metrics that require metric_type=total_value
    const totalVal = (data: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>, name: string) => {
      const m = data.find((d) => d.name === name);
      if (!m) return 0;
      if (m.total_value?.value != null) return m.total_value.value;
      return (m.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
    };

    // reach — needs period=days_28 WITHOUT metric_type to return correct rolling value
    try {
      const reachRes = await fetch(
        `${IG_API_BASE}/${igId}/insights?metric=reach&period=days_28&access_token=${encodedToken}`,
      );
      const reachJson = (await reachRes.json()) as {
        data?: Array<{ name: string; values?: Array<{ value: number }> }>;
        error?: { message: string };
      };
      if (!reachJson.error && reachJson.data) {
        reach = lastVal(reachJson.data, 'reach');
      } else if (reachJson.error) {
        this.logger.warn(`Instagram [${pp.id}] reach unavailable: ${reachJson.error.message}`);
      }
    } catch (e) {
      this.logger.warn(`Instagram [${pp.id}] reach fetch error: ${(e as Error).message}`);
    }

    // accounts_engaged, profile_views, website_clicks, total_interactions — require metric_type=total_value
    try {
      const metrics = 'accounts_engaged,profile_views,website_clicks,total_interactions';
      const insRes = await fetch(
        `${IG_API_BASE}/${igId}/insights?metric=${metrics}&period=days_28&metric_type=total_value&access_token=${encodedToken}`,
      );
      const insJson = (await insRes.json()) as {
        data?: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>;
        error?: { message: string };
      };
      if (!insJson.error && insJson.data) {
        accountsEngaged = totalVal(insJson.data, 'accounts_engaged');
        profileViews = totalVal(insJson.data, 'profile_views');
        websiteClicks = totalVal(insJson.data, 'website_clicks');
        totalInteractions = totalVal(insJson.data, 'total_interactions');
      } else if (insJson.error) {
        this.logger.warn(`Instagram [${pp.id}] insights unavailable: ${insJson.error.message}`);
      }
    } catch (e) {
      this.logger.warn(`Instagram [${pp.id}] insights fetch error: ${(e as Error).message}`);
    }

    // Try impressions first (includes paid + organic), fall back to views (organic only)
    try {
      const impRes = await fetch(
        `${IG_API_BASE}/${igId}/insights?metric=impressions&period=days_28&metric_type=total_value&access_token=${encodedToken}`,
      );
      const impJson = (await impRes.json()) as {
        data?: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>;
        error?: { message: string };
      };
      this.logger.log(`Instagram [${pp.id}] impressions raw: ${JSON.stringify(impJson).slice(0, 300)}`);
      if (!impJson.error && impJson.data) {
        const m = impJson.data.find((d) => d.name === 'impressions');
        if (m?.total_value?.value) {
          impressions28d = m.total_value.value;
          this.logger.log(`Instagram [${pp.id}] impressions (paid+organic): ${impressions28d}`);
        }
      }
      // fallback to organic-only views if impressions unavailable
      if (impressions28d === 0) {
        const viewsRes = await fetch(
          `${IG_API_BASE}/${igId}/insights?metric=views&period=days_28&metric_type=total_value&access_token=${encodedToken}`,
        );
        const viewsJson = (await viewsRes.json()) as {
          data?: Array<{ name: string; total_value?: { value: number } }>;
          error?: { message: string };
        };
        if (!viewsJson.error && viewsJson.data) {
          const m = viewsJson.data.find((d) => d.name === 'views');
          if (m?.total_value?.value != null) impressions28d = m.total_value.value;
        }
        if (impJson.error) this.logger.warn(`Instagram [${pp.id}] impressions unavailable: ${impJson.error.message}`);
      }
    } catch (e) {
      this.logger.warn(`Instagram [${pp.id}] views fetch error: ${(e as Error).message}`);
    }

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setUTCDate(periodStart.getUTCDate() - 28);

    const snapshotMetrics: Array<[string, number]> = [
      ['followers_count', followersCount],
      ['reach_28d', reach],
      ['impressions_28d', accountsEngaged],
      ['views_28d', impressions28d],
      ['total_interactions_28d', totalInteractions],
      ['profile_visits_28d', profileViews],
      ['website_clicks_28d', websiteClicks],
    ];

    await this.prisma.snapshot.createMany({
      data: snapshotMetrics.map(([metricKey, metricValue]) => ({
        projectPlatformId: pp.id,
        metricKey,
        metricValue: new Prisma.Decimal(metricValue),
        periodStart,
        periodEnd: now,
      })),
    });

    await this.prisma.projectPlatform.update({
      where: { id: pp.id },
      data: { lastSyncAt: now, lastError: null, status: IntegrationStatus.ACTIVE },
    });

    await this.prisma.integrationLog.create({
      data: {
        source: 'instagram',
        operation: 'sync',
        status: IntegrationCallStatus.SUCCESS,
        durationMs: Date.now() - start,
        projectPlatformId: pp.id,
      },
    });

    this.logger.log(`Instagram snapshot OK for ${pp.id}: followers=${followersCount}, reach=${reach}`);
  }
}
