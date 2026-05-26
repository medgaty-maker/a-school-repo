import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';

const API_BASE = 'https://api-metrika.yandex.net/stat/v1/data';

interface MetricaResponse {
  totals: number[];
  total_rows: number;
}

export interface CounterLeads {
  counterId: string;
  name: string;
  phone: number;
  messenger: number;
  form: number;
  social: number;
  total: number;
}

export interface LeadBreakdown {
  phone: number;
  messenger: number;
  form: number;
  social: number;
  total: number;
  period: string;
  counters: CounterLeads[];
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

  private readonly counterGoals: Record<string, { name: string; phone?: number; messenger?: number; form?: number; social?: number }> = {
    '105849697': { name: 'Авторская школа', phone: 515884639, messenger: 495561583, form: 495567928, social: 496509659 },
    '106777545': { name: 'AVS', messenger: 511869511, form: 511920198 },
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
      return { phone: 0, messenger: 0, form: 0, social: 0, total: 0, period: datePreset, counters: [] };
    }

    const counterIds = cfg.counterIds.split(',').map((s) => s.trim()).filter(Boolean);
    const { dateFrom, dateTo } = resolveDates(datePreset);

    const fetchGoal = async (counterId: string, goalId: number): Promise<number> => {
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
        this.logger.warn(`Metrica counter ${counterId} goal ${goalId} error ${res.status}`);
        return 0;
      }

      const data = (await res.json()) as MetricaResponse;
      return Math.round(data?.totals?.[0] ?? 0);
    };

    let phone = 0, messenger = 0, form = 0, social = 0;
    const counters: import('./yandex-metrica.service').CounterLeads[] = [];

    for (const counterId of counterIds) {
      const goals = this.counterGoals[counterId];
      if (!goals) continue;
      const [p, m, f, s] = await Promise.all([
        goals.phone    ? fetchGoal(counterId, goals.phone)    : Promise.resolve(0),
        goals.messenger? fetchGoal(counterId, goals.messenger): Promise.resolve(0),
        goals.form     ? fetchGoal(counterId, goals.form)     : Promise.resolve(0),
        goals.social   ? fetchGoal(counterId, goals.social)   : Promise.resolve(0),
      ]);
      phone += p; messenger += m; form += f; social += s;
      counters.push({ counterId, name: goals.name, phone: p, messenger: m, form: f, social: s, total: p + m + f + s });
    }

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
      counters,
    };
  }
}
