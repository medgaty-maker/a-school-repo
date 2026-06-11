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

  // slug проекта → его счётчики. undefined без проекта (все), [] если маппинг пуст (0).
  async resolveProjectCounterIds(slug?: string): Promise<string[] | undefined> {
    if (!slug) return undefined;
    const p = await this.prisma.project.findUnique({
      where: { slug },
      select: { metricaCounterIds: true },
    });
    return (p?.metricaCounterIds ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  async getDailyVisits(datePreset = 'last_28d', filterIds?: string[]): Promise<Array<{ date: string; visits: number }>> {
    const token = await this.getToken();
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!token || !cfg) return [];

    let counterIds = cfg.counterIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (filterIds) counterIds = counterIds.filter((c) => filterIds.includes(c));
    const { dateFrom, dateTo } = resolveDates(datePreset);

    const byDate = new Map<string, number>();

    for (const counterId of counterIds) {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', 'ym:s:visits');
      url.searchParams.set('dimensions', 'ym:s:date');
      url.searchParams.set('sort', 'ym:s:date');
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
      if (!res.ok) continue;

      const data = (await res.json()) as { data?: Array<{ dimensions: Array<{ id: string }>; metrics: number[] }> };
      for (const row of data.data ?? []) {
        const date = row.dimensions?.[0]?.id ?? '';
        const visits = Math.round(row.metrics?.[0] ?? 0);
        byDate.set(date, (byDate.get(date) ?? 0) + visits);
      }
    }

    return [...byDate.entries()].map(([date, visits]) => ({ date, visits })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLeads(datePreset = 'last_28d', filterIds?: string[]): Promise<LeadBreakdown> {
    const token = await this.getToken();
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!token || !cfg) {
      return { phone: 0, messenger: 0, form: 0, social: 0, total: 0, period: datePreset, counters: [] };
    }

    let counterIds = cfg.counterIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (filterIds) counterIds = counterIds.filter((c) => filterIds.includes(c));
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

  async getAiInsights(): Promise<{ recommendations: any[]; summary: string; generatedAt: string } | null> {
    const token = await this.getToken();
    const cfg = await this.prisma.yandexMetricaConfig.findFirst();
    if (!token || !cfg) return null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const counterIds = cfg.counterIds.split(',').map((s) => s.trim()).filter(Boolean);
    const { dateFrom, dateTo } = resolveDates('last_28d');

    const fetchBehavior = async (counterId: string) => {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', 'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds,ym:s:pageDepth');
      url.searchParams.set('dimensions', 'ym:s:startURL');
      url.searchParams.set('sort', '-ym:s:visits');
      url.searchParams.set('limit', '15');
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      const res = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: any[] };
      return (data.data ?? []).map((row: any) => ({
        url: row.dimensions?.[0]?.name ?? '',
        visits: Math.round(row.metrics?.[0] ?? 0),
        bounceRate: Math.round(row.metrics?.[1] ?? 0),
        avgDuration: Math.round(row.metrics?.[2] ?? 0),
        pageDepth: +(row.metrics?.[3] ?? 0).toFixed(1),
      }));
    };

    const fetchSummary = async (counterId: string) => {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', 'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds,ym:s:pageDepth');
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      const res = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
      if (!res.ok) return null;
      const data = (await res.json()) as { totals?: number[] };
      const t = data.totals ?? [];
      return { visits: Math.round(t[0] ?? 0), bounceRate: Math.round(t[1] ?? 0), avgDuration: Math.round(t[2] ?? 0), pageDepth: +(t[3] ?? 0).toFixed(1) };
    };

    const fetchExitPages = async (counterId: string) => {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', 'ym:pv:exits');
      url.searchParams.set('dimensions', 'ym:pv:URL');
      url.searchParams.set('sort', '-ym:pv:exits');
      url.searchParams.set('limit', '10');
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      const res = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: any[] };
      return (data.data ?? []).map((row: any) => ({
        url: row.dimensions?.[0]?.name ?? '',
        exits: Math.round(row.metrics?.[0] ?? 0),
      }));
    };

    const fetchSessionDepth = async (counterId: string) => {
      const url = new URL(API_BASE);
      url.searchParams.set('id', counterId);
      url.searchParams.set('metrics', 'ym:s:visits');
      url.searchParams.set('dimensions', 'ym:s:pageDepth');
      url.searchParams.set('sort', 'ym:s:pageDepth');
      url.searchParams.set('limit', '10');
      url.searchParams.set('date1', dateFrom);
      url.searchParams.set('date2', dateTo);
      const res = await fetch(url.toString(), { headers: { Authorization: `OAuth ${token}` } });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: any[]; totals?: number[] };
      const rows = (data.data ?? []).map((row: any) => ({
        depth: Math.round(row.dimensions?.[0]?.id ?? 0),
        visits: Math.round(row.metrics?.[0] ?? 0),
      }));
      return rows;
    };

    const allPages: any[] = [];
    const summaries: any[] = [];
    const allExitPages: any[] = [];
    const goals = this.counterGoals;

    for (const cid of counterIds) {
      const [pages, summary, exitPages, depthRows] = await Promise.all([
        fetchBehavior(cid),
        fetchSummary(cid),
        fetchExitPages(cid),
        fetchSessionDepth(cid),
      ]);
      allPages.push(...pages.map((p: any) => ({ ...p, counter: goals[cid]?.name ?? cid })));
      if (summary) summaries.push({ counter: goals[cid]?.name ?? cid, ...summary });
      allExitPages.push(...exitPages.map((e: any) => ({ ...e, counter: goals[cid]?.name ?? cid })));
      // attach depth distribution to summary
      if (summary && depthRows.length > 0) {
        const totalVisits = depthRows.reduce((s: number, r: any) => s + r.visits, 0) || 1;
        summaries[summaries.length - 1].depthDistribution = depthRows.slice(0, 5).map((r: any) => ({
          depth: r.depth,
          pct: Math.round((r.visits / totalVisits) * 100),
        }));
      }
    }

    const topExitPages = allExitPages.sort((a, b) => b.exits - a.exits).slice(0, 5);
    const highBounce = allPages.filter((p) => p.bounceRate > 60 && p.visits > 50).slice(0, 5);
    const lowDuration = allPages.filter((p) => p.avgDuration < 30 && p.visits > 30).slice(0, 5);

    const prompt = `Ты CRO-аналитик для образовательного центра "Авторская школа Жании Аубакировой" (Казахстан).
Данные Яндекс.Метрики (включая данные вебвизора) за ${dateFrom} — ${dateTo}:

ОБЩИЕ ПОКАЗАТЕЛИ:
${summaries.map((s) => `${s.counter}: ${s.visits} визитов, ${s.bounceRate}% отказов, ${s.avgDuration}с среднее время, глубина ${s.pageDepth} стр.`).join('\n')}

ДАННЫЕ ВЕБВИЗОРА — СТРАНИЦЫ ВЫХОДА (откуда пользователи уходят чаще всего):
${topExitPages.length > 0 ? topExitPages.map((p) => `${p.url}: ${p.exits} выходов`).join('\n') : 'нет данных'}

ГЛУБИНА СЕССИЙ (сколько страниц просматривают за визит):
${summaries.map((s) => s.depthDistribution ? `${s.counter}: ${s.depthDistribution.map((d: any) => `${d.depth} стр — ${d.pct}%`).join(', ')}` : '').filter(Boolean).join('\n') || 'нет данных'}

СТРАНИЦЫ С ВЫСОКИМ ОТКАЗОМ (>60%, >50 визитов):
${highBounce.length > 0 ? highBounce.map((p) => `${p.url}: ${p.bounceRate}% отказов, ${p.visits} визитов, ${p.avgDuration}с`).join('\n') : 'нет'}

СТРАНИЦЫ С КОРОТКИМ ВРЕМЕНЕМ (<30с, >30 визитов):
${lowDuration.length > 0 ? lowDuration.map((p) => `${p.url}: ${p.avgDuration}с, ${p.visits} визитов`).join('\n') : 'нет'}

ТОП-10 СТРАНИЦ ПО ТРАФИКУ:
${allPages.slice(0, 10).map((p) => `${p.url}: ${p.visits} визитов, ${p.bounceRate}% отказов, ${p.avgDuration}с`).join('\n')}

Дай 5 конкретных рекомендаций по улучшению конверсии в заявку/звонок/переписку. Используй данные о страницах выхода и глубине сессий для конкретных предложений. Ответь строго в JSON:
{"recommendations":[{"priority":"высокий|средний|низкий","page":"URL или 'весь сайт'","issue":"проблема","recommendation":"что сделать","expectedImpact":"ожидаемый эффект"}],"summary":"1-2 предложения об общем состоянии"}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      this.logger.warn(`Claude API error: ${aiRes.status}`);
      return null;
    }

    const aiData = (await aiRes.json()) as { content?: Array<{ text?: string }> };
    const text = aiData.content?.[0]?.text ?? '';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? text);
      return { ...parsed, generatedAt: new Date().toISOString() };
    } catch {
      return { recommendations: [], summary: text.slice(0, 300), generatedAt: new Date().toISOString() };
    }
  }
}
