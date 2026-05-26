import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY ?? '';
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI ?? '';
const API_BASE = 'https://open.tiktokapis.com/v2';

export interface TikTokStats {
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
  display_name: string;
  avatar_url?: string;
}

export interface TikTokVideo {
  id: string;
  title: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  cover_image_url?: string;
}

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_key: CLIENT_KEY,
      response_type: 'code',
      scope: 'user.info.basic,user.info.stats,video.list',
      redirect_uri: REDIRECT_URI,
      state: 'tiktok_oauth',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<{ success: boolean; displayName?: string; error?: string }> {
    const tokenRes = await fetch(`${API_BASE}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      this.logger.error(`TikTok token exchange failed: ${tokenRes.status} ${err}`);
      return { success: false, error: `Token exchange failed: ${tokenRes.status}` };
    }

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      this.logger.error(`TikTok token error: ${tokenData.error} ${tokenData.error_description}`);
      return { success: false, error: tokenData.error_description ?? tokenData.error };
    }

    const { access_token, refresh_token, expires_in, open_id } = tokenData;

    let displayName: string | undefined;
    try {
      const userRes = await fetch(`${API_BASE}/user/info/?fields=display_name,avatar_url`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userData = await userRes.json() as { data?: { user?: { display_name?: string } } };
      displayName = userData?.data?.user?.display_name;
    } catch (e) {
      this.logger.warn(`Could not fetch TikTok display name: ${e}`);
    }

    const existing = await this.prisma.tikTokConfig.findFirst();
    const data = {
      openId: open_id ?? '',
      displayName,
      accessTokenEnc: this.crypto.encrypt(access_token),
      refreshTokenEnc: refresh_token ? this.crypto.encrypt(refresh_token) : null,
      tokenExpiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
    };

    if (existing) {
      await this.prisma.tikTokConfig.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.tikTokConfig.create({ data });
    }

    return { success: true, displayName };
  }

  async getConfig() {
    const cfg = await this.prisma.tikTokConfig.findFirst();
    if (!cfg) return null;
    return {
      id: cfg.id,
      openId: cfg.openId,
      displayName: cfg.displayName,
      tokenExpiresAt: cfg.tokenExpiresAt,
      lastSyncAt: cfg.lastSyncAt,
      authUrl: this.getAuthUrl(),
    };
  }

  async disconnect() {
    const cfg = await this.prisma.tikTokConfig.findFirst();
    if (cfg) await this.prisma.tikTokConfig.delete({ where: { id: cfg.id } });
  }

  private async getToken(): Promise<string | null> {
    const cfg = await this.prisma.tikTokConfig.findFirst();
    if (!cfg) return null;
    try {
      return this.crypto.decrypt(cfg.accessTokenEnc);
    } catch {
      return null;
    }
  }

  async getStats(): Promise<TikTokStats | null> {
    const token = await this.getToken();
    if (!token) return null;

    const fields = 'display_name,avatar_url,follower_count,following_count,likes_count,video_count';
    const res = await fetch(`${API_BASE}/user/info/?fields=${fields}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      this.logger.warn(`TikTok user info error: ${res.status}`);
      return null;
    }

    const data = await res.json() as { data?: { user?: TikTokStats } };

    const cfg = await this.prisma.tikTokConfig.findFirst();
    if (cfg) {
      await this.prisma.tikTokConfig.update({
        where: { id: cfg.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return data?.data?.user ?? null;
  }

  async getVideos(): Promise<TikTokVideo[]> {
    const token = await this.getToken();
    if (!token) return [];

    const fields = 'id,title,create_time,view_count,like_count,comment_count,share_count,cover_image_url';
    const res = await fetch(`${API_BASE}/video/list/?fields=${fields}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    });

    if (!res.ok) {
      this.logger.warn(`TikTok video list error: ${res.status}`);
      return [];
    }

    const data = await res.json() as { data?: { videos?: TikTokVideo[] } };
    return data?.data?.videos ?? [];
  }
}
