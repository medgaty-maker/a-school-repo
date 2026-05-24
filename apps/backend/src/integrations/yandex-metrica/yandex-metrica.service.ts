import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';

const API_BASE = 'https://api-metrika.yandex.net/stat/v1/data';

interface MetricaResponse {
  totals: number[];
  total_rows: number;
}

export interface LeadBreakdown {
  phone: number;
  messenger: number;
  form: number;
  social: number;
  total: number;
  period: string;
}

// Preset → [date_from, date_to] in YYYY-MM-DD
function resolveDates(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const sub = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() - days);
    return r;
  };

  switch (preset) {
    case 'last_7d':
      return { dateFrom: fmt(sub(now, 7)), dateTo: fmt(now) };
    case 'last_14d':
      return { dateFrom: fmt(sub(now, 14)), dateTo: fmt(now) };
    case 'last_28d':
      return { dateFrom: fmt(sub(now, 28)), dateTo: fmt(now) };
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: fmt(from), dateTo: fmt(now) };
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: fmt(from), dateTo: fmt(to) };
    }
    default:
      return { dateFrom: fmt(sub(now, 28)), dateTo: fmt(now) };
  }
}

@Injectable()
export class YandexMetricaService {
  private readonly logger = new Logger(YandexMetricaService.name);

  // Goal IDs for counter 105849697
  private readonly goalMap = {
    phone: 515884639,
    messenger: 495561583,
    form: 495567928,
    social: 496509659,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getConfig() {
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!cfg) return null;
    try {
      return {
        id: cfg.id,
        counterIds: cfg.counterIds,
        lastSyncAt: cfg.lastSyncAt,
      };
    } catch {
      return null;
    }
  }

  async setConfig(token: string, counterIds: string) {
    const tokenEnc = this.crypto.encrypt(token.trim());
    const existing = await this.prisma.yandexMetricaConfig.findFirst();
    if (existing) {
      return this.prisma.yandexMetricaConfig.update({
        where: { id: existing.id },
        data: { accessTokenEnc: tokenEnc, counterIds: counterIds.trim() },
      });
    }
    return this.prisma.yandexMetricaConfig.create({
      data: { accessTokenEnc: tokenEnc, counterIds: counterIds.trim() },
    });
  }

  private async getToken(): Promise<string | null> {
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!cfg) return null;
    try {
      return this.crypto.decrypt(cfg.accessTokenEnc);
    } catch {
      return null;
    }
  }

  async getLeads(datePreset = 'last_28d'): Promise<LeadBreakdown> {
    const token = await this.getToken();
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!token || !cfg) {
      return { phone: 0, messenger: 0, form: 0, social: 0, total: 0, period: datePreset };
    }

    const counterId = cfg.counterIds.split(',')[0].trim();
    const { dateFrom, dateTo } = resolveDates(datePreset);

    const fetchGoal = async (goalId: number): Promise<number> => {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', `ym:s:goal${goalId}reaches`);
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      url.searchParams.set('limit', '1');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `OAuth ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Metrica goal ${goalId} error ${res.status}: ${text}`);
        return 0;
      }

      const data = (await res.json()) as MetricaResponse;
      const val = data?.totals?.[0] ?? 0;
      return Math.round(val);
    };

    const [phone, messenger, form, social] = await Promise.all([
      fetchGoal(this.goalMap.phone),
      fetchGoal(this.goalMap.messenger),
      fetchGoal(this.goalMap.form),
      fetchGoal(this.goalMap.social),
    ]);

    await this.prisma.yandexMetricaConfig.update({
      where: { id: cfg.id },
      data: { lastSyncAt: new Date() },
    });

    return {
      phone,
      messenger,
      form,
      social,
      total: phone + messenger + form + social,
      period: `${dateFrom} — ${dateTo}`,
    };
  }
}
