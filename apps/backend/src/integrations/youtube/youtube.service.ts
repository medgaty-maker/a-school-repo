import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';
import {
  IntegrationCallStatus,
  IntegrationStatus,
  Platform,
  Prisma,
} from '@prisma/client';

const SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

type ChannelStats = {
  id: string;
  title: string;
  thumbnail: string;
  customUrl: string;
  subscribers: number;
  views: number;
  videos: number;
};

type YoutubeDetail = {
  period: { startDate: string; endDate: string };
  totals: Record<string, number>;
  daily_views: Array<{ day: string; views: number; estimatedMinutesWatched: number }>;
  traffic_sources: Array<{ insightTrafficSourceType: string; views: number }>;
  demographics: Array<{ ageGroup: string; gender: string; viewerPercentage: number }>;
  countries: Array<{ country: string; views: number }>;
  devices: Array<{ deviceType: string; views: number }>;
  operating_systems: Array<{ operatingSystem: string; views: number }>;
};

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly accessTokenCache = new Map<string, { token: string; fetchedAt: number }>();
  private readonly detailCache = new Map<string, { data: YoutubeDetail; fetchedAt: number }>();
  private readonly ACCESS_TTL = 50 * 60 * 1000;
  private readonly DETAIL_TTL = 60 * 60 * 1000; // 1 час

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // --- OAuth flow (адаптировано из /Users/eldarkoziyev/Projects/Guryk/setup-oauth.js) ---

  buildAuthUrl(projectPlatformId: string): string {
    const clientId = this.requireEnv('YOUTUBE_CLIENT_ID');
    const redirect = this.requireEnv('YOUTUBE_OAUTH_REDIRECT');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent select_account');
    url.searchParams.set('state', projectPlatformId);
    return url.toString();
  }

  async handleCallback(code: string, state: string): Promise<{ projectPlatformId: string; channelId: string; channelTitle: string }> {
    const projectPlatform = await this.prisma.projectPlatform.findUnique({ where: { id: state } });
    if (!projectPlatform || projectPlatform.platform !== Platform.YOUTUBE) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const tokens = await this.exchangeCode(code);
    const channel = await this.fetchMyChannel(tokens.access_token);

    await this.prisma.projectPlatform.update({
      where: { id: projectPlatform.id },
      data: {
        externalAccountId: channel.id,
        externalAccountName: channel.title,
        accessTokenEnc: this.crypto.encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? this.crypto.encrypt(tokens.refresh_token)
          : projectPlatform.refreshTokenEnc,
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        status: IntegrationStatus.ACTIVE,
        lastError: null,
      },
    });

    return { projectPlatformId: projectPlatform.id, channelId: channel.id, channelTitle: channel.title };
  }

  async disconnect(projectPlatformId: string) {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || pp.platform !== Platform.YOUTUBE) throw new NotFoundException('platform not found');
    await this.prisma.projectPlatform.update({
      where: { id: projectPlatformId },
      data: {
        status: IntegrationStatus.NOT_CONNECTED,
        externalAccountId: null,
        externalAccountName: null,
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        lastSyncAt: null,
        lastError: null,
      },
    });
    this.accessTokenCache.delete(projectPlatformId);
    this.detailCache.delete(projectPlatformId);
    return { ok: true };
  }

  // --- Capture snapshot (вызывается из cron'а или /snapshots/run) ---

  async captureSnapshot(projectPlatformId: string) {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp || !pp.externalAccountId) throw new NotFoundException('platform not connected');

    const start = Date.now();
    try {
      const channel = await this.fetchChannelStats(pp.externalAccountId);
      const accessToken = await this.getAccessToken(pp.id);
      const analytics = await this.fetchAnalytics28d(accessToken);

      const now = new Date();
      const periodStart = new Date(now);
      periodStart.setUTCDate(periodStart.getUTCDate() - 28);

      const metrics: Array<[string, number]> = [
        ['subscribers_total', channel.subscribers],
        ['views_total', channel.views],
        ['videos_total', channel.videos],
        ['views_28d', Number(analytics.views || 0)],
        ['watch_time_minutes_28d', Number(analytics.estimatedMinutesWatched || 0)],
        ['avg_view_duration_28d', Number(analytics.averageViewDuration || 0)],
        ['avg_view_percentage_28d', Number(analytics.averageViewPercentage || 0)],
        ['subscribers_gained_28d', Number(analytics.subscribersGained || 0)],
        ['subscribers_lost_28d', Number(analytics.subscribersLost || 0)],
        ['likes_28d', Number(analytics.likes || 0)],
        ['comments_28d', Number(analytics.comments || 0)],
        ['shares_28d', Number(analytics.shares || 0)],
      ];

      await this.prisma.snapshot.createMany({
        data: metrics.map(([metricKey, metricValue]) => ({
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
          source: 'youtube',
          operation: 'sync',
          status: IntegrationCallStatus.SUCCESS,
          durationMs: Date.now() - start,
          projectPlatformId: pp.id,
        },
      });
    } catch (e) {
      const err = (e as Error).message;
      await this.prisma.projectPlatform.update({
        where: { id: pp.id },
        data: { lastError: err, status: IntegrationStatus.ERROR },
      });
      await this.prisma.integrationLog.create({
        data: {
          source: 'youtube',
          operation: 'sync',
          status: IntegrationCallStatus.ERROR,
          durationMs: Date.now() - start,
          errorMessage: err,
          projectPlatformId: pp.id,
        },
      });
      throw e;
    }
  }

  // --- Read API (для UI) ---

  async getChannelInfo(projectPlatformId: string) {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.externalAccountId) throw new NotFoundException('not connected');
    return this.fetchChannelStats(pp.externalAccountId);
  }

  async getRecentVideos(projectPlatformId: string, max = 10) {
    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.externalAccountId) throw new NotFoundException('not connected');
    return this.fetchRecentVideos(pp.externalAccountId, max);
  }

  async getDetail(projectPlatformId: string): Promise<YoutubeDetail> {
    const cached = this.detailCache.get(projectPlatformId);
    if (cached && Date.now() - cached.fetchedAt < this.DETAIL_TTL) return cached.data;

    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.externalAccountId || !pp.refreshTokenEnc) throw new NotFoundException('not connected');

    const accessToken = await this.getAccessToken(projectPlatformId);
    const detail = await this.fetchDetailedAnalytics(accessToken);
    this.detailCache.set(projectPlatformId, { data: detail, fetchedAt: Date.now() });
    return detail;
  }

  // --- Internals (порт логики из server.js:200-441) ---

  private async exchangeCode(code: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.requireEnv('YOUTUBE_CLIENT_ID'),
        client_secret: this.requireEnv('YOUTUBE_CLIENT_SECRET'),
        redirect_uri: this.requireEnv('YOUTUBE_OAUTH_REDIRECT'),
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) {
      throw new BadRequestException(`Token exchange failed: ${JSON.stringify(data)}`);
    }
    return data as { access_token: string; refresh_token?: string; expires_in?: number };
  }

  private async fetchMyChannel(accessToken: string): Promise<ChannelStats> {
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = (await r.json()) as { items?: any[] };
    if (!r.ok) throw new Error(`channels.list (mine): ${JSON.stringify(j)}`);
    const item = j.items?.[0];
    if (!item) throw new BadRequestException('account has no YouTube channel');
    return this.toChannelStats(item);
  }

  private async fetchChannelStats(channelId: string): Promise<ChannelStats> {
    const apiKey = this.requireEnv('YOUTUBE_API_KEY');
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('id', channelId);
    url.searchParams.set('key', apiKey);
    const r = await fetch(url);
    const j = (await r.json()) as { items?: any[] };
    if (!r.ok) throw new Error(`channels.list: ${JSON.stringify(j)}`);
    const item = j.items?.[0];
    if (!item) throw new NotFoundException('channel not found');
    return this.toChannelStats(item);
  }

  private toChannelStats(item: any): ChannelStats {
    return {
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.default?.url || '',
      customUrl: item.snippet.customUrl || '',
      subscribers: Number(item.statistics?.subscriberCount || 0),
      views: Number(item.statistics?.viewCount || 0),
      videos: Number(item.statistics?.videoCount || 0),
    };
  }

  private async fetchRecentVideos(channelId: string, maxResults = 10) {
    const apiKey = this.requireEnv('YOUTUBE_API_KEY');
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', channelId);
    searchUrl.searchParams.set('order', 'date');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('key', apiKey);
    const sr = await fetch(searchUrl);
    const sd = (await sr.json()) as { items?: any[] };
    if (!sr.ok) throw new Error(`search.list: ${JSON.stringify(sd)}`);
    const ids = (sd.items || []).map((i) => i.id?.videoId).filter(Boolean);
    if (!ids.length) return [];

    const vidUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    vidUrl.searchParams.set('part', 'snippet,statistics,contentDetails');
    vidUrl.searchParams.set('id', ids.join(','));
    vidUrl.searchParams.set('key', apiKey);
    const vr = await fetch(vidUrl);
    const vd = (await vr.json()) as { items?: any[] };
    if (!vr.ok) throw new Error(`videos.list: ${JSON.stringify(vd)}`);

    return (vd.items || []).map((v) => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
      duration: v.contentDetails?.duration || '',
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
    }));
  }

  private async getAccessToken(projectPlatformId: string): Promise<string> {
    const cached = this.accessTokenCache.get(projectPlatformId);
    if (cached && Date.now() - cached.fetchedAt < this.ACCESS_TTL) return cached.token;

    const pp = await this.prisma.projectPlatform.findUnique({ where: { id: projectPlatformId } });
    if (!pp?.refreshTokenEnc) throw new Error('No refresh token stored');
    const refreshToken = this.crypto.decrypt(pp.refreshTokenEnc);

    // Per-platform OAuth client с fallback на глобальный
    const clientId = pp.oauthClientIdEnc
      ? this.crypto.decrypt(pp.oauthClientIdEnc)
      : this.requireEnv('YOUTUBE_CLIENT_ID');
    const clientSecret = pp.oauthClientSecretEnc
      ? this.crypto.decrypt(pp.oauthClientSecretEnc)
      : this.requireEnv('YOUTUBE_CLIENT_SECRET');

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!r.ok || !j.access_token) throw new Error(`refresh failed: ${JSON.stringify(j)}`);

    // Save rotated refresh_token if Google issues a new one
    if (j.refresh_token) {
      await this.prisma.projectPlatform.update({
        where: { id: projectPlatformId },
        data: { refreshTokenEnc: this.crypto.encrypt(j.refresh_token) },
      });
    }

    this.accessTokenCache.set(projectPlatformId, { token: j.access_token, fetchedAt: Date.now() });
    return j.access_token;
  }

  private async fetchDetailedAnalytics(accessToken: string): Promise<YoutubeDetail> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 28);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const query = async (params: Record<string, string | number>) => {
      const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
      url.searchParams.set('ids', 'channel==MINE');
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = (await r.json()) as { columnHeaders?: any[]; rows?: any[] };
      if (!r.ok) throw new Error(`analytics ${JSON.stringify(params)}: ${JSON.stringify(j)}`);
      const cols: string[] = (j.columnHeaders || []).map((c) => c.name);
      const rows = j.rows || [];
      return rows.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
    };

    const [
      totalsRows,
      daily,
      traffic,
      demographics,
      countries,
      devices,
      os,
    ] = await Promise.all([
      query({ metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares' }),
      query({ metrics: 'views,estimatedMinutesWatched', dimensions: 'day', sort: 'day' }),
      query({ metrics: 'views', dimensions: 'insightTrafficSourceType', sort: '-views' }),
      query({ metrics: 'viewerPercentage', dimensions: 'ageGroup,gender', sort: 'gender,ageGroup' }),
      query({ metrics: 'views', dimensions: 'country', sort: '-views', maxResults: 10 }),
      query({ metrics: 'views', dimensions: 'deviceType', sort: '-views' }),
      query({ metrics: 'views', dimensions: 'operatingSystem', sort: '-views' }),
    ]);

    return {
      period: { startDate, endDate },
      totals: (totalsRows[0] as Record<string, number>) ?? {},
      daily_views: daily.map((r: any) => ({
        day: String(r.day),
        views: Number(r.views ?? 0),
        estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
      })),
      traffic_sources: traffic.map((r: any) => ({
        insightTrafficSourceType: String(r.insightTrafficSourceType),
        views: Number(r.views ?? 0),
      })),
      demographics: demographics.map((r: any) => ({
        ageGroup: String(r.ageGroup),
        gender: String(r.gender),
        viewerPercentage: Number(r.viewerPercentage ?? 0),
      })),
      countries: countries.map((r: any) => ({
        country: String(r.country),
        views: Number(r.views ?? 0),
      })),
      devices: devices.map((r: any) => ({
        deviceType: String(r.deviceType),
        views: Number(r.views ?? 0),
      })),
      operating_systems: os.map((r: any) => ({
        operatingSystem: String(r.operatingSystem),
        views: Number(r.views ?? 0),
      })),
    };
  }

  private async fetchAnalytics28d(accessToken: string): Promise<Record<string, number>> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 28);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', 'channel==MINE');
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set(
      'metrics',
      'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares',
    );

    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = (await r.json()) as { columnHeaders?: any[]; rows?: any[]; error?: any };
    if (!r.ok) throw new Error(`analytics: ${JSON.stringify(j)}`);

    const cols: string[] = (j.columnHeaders || []).map((c) => c.name);
    const row = j.rows?.[0] || [];
    const out: Record<string, number> = {};
    cols.forEach((c, i) => {
      out[c] = Number(row[i] ?? 0);
    });
    return out;
  }

  private requireEnv(key: string): string {
    const v = process.env[key];
    if (!v) throw new Error(`${key} env is required`);
    return v;
  }
}
