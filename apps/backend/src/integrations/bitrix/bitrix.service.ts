import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';
import { Decimal } from '@prisma/client/runtime/library';

interface BitrixDealRaw {
  ID: string;
  TITLE: string;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID?: string; // 'S' = успех (won), 'F' = провал (lost), 'P' = в работе
  IS_WON?: string;
  CATEGORY_ID?: string;
  SOURCE_ID?: string;
  UTM_SOURCE?: string;
  UTM_MEDIUM?: string;
  UTM_CAMPAIGN?: string;
  UTM_CONTENT?: string;
  ASSIGNED_BY_ID?: string;
  OPPORTUNITY?: string;
  CURRENCY_ID?: string;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  CLOSEDATE?: string;
}

interface BitrixLeadRaw {
  ID: string;
  TITLE?: string;
  STATUS_ID?: string;
  SOURCE_ID?: string;
  DATE_CREATE: string;
  DATE_MODIFY?: string;
}

interface BitrixStage {
  STATUS_ID: string;
  NAME: string;
  CATEGORY_ID?: string;
}

interface BitrixCategory {
  ID: string;
  NAME: string;
}

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async getWebhookUrl(): Promise<string | null> {
    const config = await this.prisma.bitrixConfig.findFirst();
    if (!config) return null;
    try {
      return this.crypto.decrypt(config.webhookUrlEnc);
    } catch {
      return null;
    }
  }

  async setWebhookUrl(url: string) {
    const webhookUrlEnc = this.crypto.encrypt(url.trim().replace(/\/?$/, '/'));
    const existing = await this.prisma.bitrixConfig.findFirst();
    if (existing) {
      return this.prisma.bitrixConfig.update({
        where: { id: existing.id },
        data: { webhookUrlEnc },
      });
    }
    return this.prisma.bitrixConfig.create({ data: { webhookUrlEnc } });
  }

  async getStatus() {
    const config = await this.prisma.bitrixConfig.findFirst();
    if (!config) return { configured: false, lastSyncAt: null, totalDeals: 0 };
    const totalDeals = await this.prisma.bitrixDeal.count();
    return {
      configured: true,
      lastSyncAt: config.lastSyncAt,
      totalDeals,
    };
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'bitrix-sync' })
  async syncScheduled() {
    const configured = await this.getWebhookUrl();
    if (!configured) return;
    this.logger.log('Cron: bitrix-sync start');
    try {
      const r = await this.sync();
      this.logger.log(`Cron: bitrix-sync done — ${r.synced} deals`);
    } catch (e) {
      this.logger.error(`Cron: bitrix-sync failed — ${(e as Error).message}`);
    }
  }

  private syncing = false;
  isSyncing(): boolean {
    return this.syncing;
  }

  async sync(): Promise<{ synced: number; errors: number }> {
    if (this.syncing) {
      this.logger.warn('Bitrix sync уже идёт — пропускаю повторный запуск');
      return { synced: 0, errors: 0 };
    }
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) throw new BadRequestException('Bitrix24 webhook not configured');
    this.syncing = true;

    const start = Date.now();
    let synced = 0;
    let errors = 0;

    try {
      const [deals, stages, categories] = await Promise.all([
        this.fetchAllDeals(webhookUrl),
        this.fetchStages(webhookUrl),
        this.fetchCategories(webhookUrl),
      ]);

      const stageMap = new Map<string, string>(stages.map((s) => [s.STATUS_ID, s.NAME]));
      const categoryMap = new Map<string, string>(categories.map((c) => [c.ID, c.NAME]));
      categoryMap.set('0', 'Набор в школу'); // основная воронка (crm.dealcategory.default)

      for (const d of deals) {
        try {
          // Bitrix не возвращает рабочий IS_WON в crm.deal.list — признак выигрыша/
          // проигрыша берём из STAGE_SEMANTIC_ID ('S'=успех, 'F'=провал, 'P'=в работе).
          // Фолбэк на старую логику для совместимости, если поле не пришло.
          const semantic = d.STAGE_SEMANTIC_ID;
          const isWon = semantic ? semantic === 'S' : d.IS_WON === 'Y';
          const isLost = semantic ? semantic === 'F' : /LOSE|LOST|UC_LOSE/i.test(d.STAGE_ID);

          await this.prisma.bitrixDeal.upsert({
            where: { bitrixId: parseInt(d.ID) },
            update: {
              title: d.TITLE,
              stageId: d.STAGE_ID,
              stageName: stageMap.get(d.STAGE_ID) ?? d.STAGE_ID,
              categoryId: d.CATEGORY_ID ?? null,
              categoryName: d.CATEGORY_ID ? (categoryMap.get(d.CATEGORY_ID) ?? null) : categoryMap.get('0') ?? null,
              sourceId: d.SOURCE_ID ?? null,
              utmSource: d.UTM_SOURCE ?? null,
              utmMedium: d.UTM_MEDIUM ?? null,
              utmCampaign: d.UTM_CAMPAIGN ?? null,
              utmContent: d.UTM_CONTENT ?? null,
              assignedById: d.ASSIGNED_BY_ID ?? null,
              opportunity: d.OPPORTUNITY ? new Decimal(d.OPPORTUNITY) : null,
              currencyId: d.CURRENCY_ID ?? null,
              isWon,
              isLost,
              dateCreate: new Date(d.DATE_CREATE),
              dateModify: new Date(d.DATE_MODIFY),
              closeDate: d.CLOSEDATE ? new Date(d.CLOSEDATE) : null,
              syncedAt: new Date(),
            },
            create: {
              bitrixId: parseInt(d.ID),
              title: d.TITLE,
              stageId: d.STAGE_ID,
              stageName: stageMap.get(d.STAGE_ID) ?? d.STAGE_ID,
              categoryId: d.CATEGORY_ID ?? null,
              categoryName: d.CATEGORY_ID ? (categoryMap.get(d.CATEGORY_ID) ?? null) : categoryMap.get('0') ?? null,
              sourceId: d.SOURCE_ID ?? null,
              utmSource: d.UTM_SOURCE ?? null,
              utmMedium: d.UTM_MEDIUM ?? null,
              utmCampaign: d.UTM_CAMPAIGN ?? null,
              utmContent: d.UTM_CONTENT ?? null,
              assignedById: d.ASSIGNED_BY_ID ?? null,
              opportunity: d.OPPORTUNITY ? new Decimal(d.OPPORTUNITY) : null,
              currencyId: d.CURRENCY_ID ?? null,
              isWon,
              isLost,
              dateCreate: new Date(d.DATE_CREATE),
              dateModify: new Date(d.DATE_MODIFY),
              closeDate: d.CLOSEDATE ? new Date(d.CLOSEDATE) : null,
            },
          });
          synced++;
        } catch (e) {
          this.logger.warn(`Failed to upsert deal ${d.ID}: ${(e as Error).message}`);
          errors++;
        }
      }

      // Синк лидов (crm.lead) — для блока «Лиды»
      let leadsSynced = 0;
      try {
        const leads = await this.fetchAllLeads(webhookUrl);
        for (const l of leads) {
          try {
            await this.prisma.bitrixLead.upsert({
              where: { bitrixId: parseInt(l.ID) },
              update: {
                title: l.TITLE ?? null,
                statusId: l.STATUS_ID ?? null,
                sourceId: l.SOURCE_ID ?? null,
                dateCreate: new Date(l.DATE_CREATE),
                dateModify: l.DATE_MODIFY ? new Date(l.DATE_MODIFY) : null,
                syncedAt: new Date(),
              },
              create: {
                bitrixId: parseInt(l.ID),
                title: l.TITLE ?? null,
                statusId: l.STATUS_ID ?? null,
                sourceId: l.SOURCE_ID ?? null,
                dateCreate: new Date(l.DATE_CREATE),
                dateModify: l.DATE_MODIFY ? new Date(l.DATE_MODIFY) : null,
              },
            });
            leadsSynced++;
          } catch (e) {
            this.logger.warn(`Failed to upsert lead ${l.ID}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        this.logger.warn(`Bitrix leads sync failed: ${(e as Error).message}`);
      }

      await this.prisma.bitrixConfig.updateMany({ data: { lastSyncAt: new Date() } });

      await this.prisma.integrationLog.create({
        data: {
          source: 'bitrix24',
          operation: 'sync',
          status: 'SUCCESS',
          durationMs: Date.now() - start,
        },
      });

      this.logger.log(`Bitrix24 sync complete: ${synced} deals, ${leadsSynced} leads, ${errors} errors`);
    } catch (e) {
      await this.prisma.integrationLog.create({
        data: {
          source: 'bitrix24',
          operation: 'sync',
          status: 'ERROR',
          durationMs: Date.now() - start,
          errorMessage: (e as Error).message,
        },
      });
      throw e;
    } finally {
      this.syncing = false;
    }

    return { synced, errors };
  }

  // where для выборки сделок: дата + (опционально) воронки проекта.
  // categoryIds === undefined → без фильтра (глобально); [] → ничего (проект без воронок).
  private dealWhere(since: Date, categoryIds?: string[]) {
    return {
      dateCreate: { gte: since },
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    };
  }

  // slug проекта → его воронки. undefined без проекта (глобально), [] если маппинг пуст.
  async resolveProjectCategoryIds(slug?: string): Promise<string[] | undefined> {
    if (!slug) return undefined;
    const p = await this.prisma.project.findUnique({
      where: { slug },
      select: { bitrixCategoryIds: true },
    });
    return (p?.bitrixCategoryIds ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Список воронок Bitrix (для UI маппинга)
  async getCategories() {
    const rows = await this.prisma.bitrixDeal.groupBy({
      by: ['categoryId', 'categoryName'],
      _count: { _all: true },
    });
    return rows
      .filter((r) => r.categoryId)
      .map((r) => ({ categoryId: r.categoryId!, categoryName: r.categoryName, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async getFunnel(daysBack = 30, categoryIds?: string[]) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const deals = await this.prisma.bitrixDeal.findMany({
      where: this.dealWhere(since, categoryIds),
      select: { stageId: true, stageName: true, isWon: true, isLost: true, opportunity: true },
    });

    const stageMap = new Map<string, { count: number; amount: number; stageName: string; isWon: boolean; isLost: boolean }>();

    for (const d of deals) {
      const key = d.stageId;
      const name = this.humanizeStage(d.stageId, d.stageName, d.isWon, d.isLost);
      if (!stageMap.has(key)) stageMap.set(key, { count: 0, amount: 0, stageName: name, isWon: d.isWon, isLost: d.isLost });
      const entry = stageMap.get(key)!;
      entry.count++;
      entry.amount += Number(d.opportunity ?? 0);
    }

    const stages = Array.from(stageMap.entries()).map(([stageId, v]) => ({
      stageId,
      stageName: v.stageName,
      count: v.count,
      amount: Math.round(v.amount),
      isWon: v.isWon,
      isLost: v.isLost,
    }));

    const total = deals.length;
    const won = deals.filter((d) => d.isWon).length;
    const lost = deals.filter((d) => d.isLost).length;
    const inProgress = total - won - lost;
    const totalAmount = deals.filter((d) => d.isWon).reduce((s, d) => s + Number(d.opportunity ?? 0), 0);

    return {
      stages,
      summary: {
        total,
        won,
        lost,
        inProgress,
        conversionRate: total > 0 ? Math.round((won / total) * 100 * 10) / 10 : 0,
        totalAmount: Math.round(totalAmount),
      },
    };
  }

  async getSources(daysBack = 30, categoryIds?: string[]) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const deals = await this.prisma.bitrixDeal.findMany({
      where: this.dealWhere(since, categoryIds),
      select: { utmSource: true, utmCampaign: true, utmMedium: true, isWon: true, opportunity: true },
    });

    const sourceMap = new Map<string, { count: number; won: number; amount: number }>();

    for (const d of deals) {
      const src = d.utmSource ?? 'organic';
      if (!sourceMap.has(src)) sourceMap.set(src, { count: 0, won: 0, amount: 0 });
      const e = sourceMap.get(src)!;
      e.count++;
      if (d.isWon) { e.won++; e.amount += Number(d.opportunity ?? 0); }
    }

    return Array.from(sourceMap.entries())
      .map(([source, v]) => ({
        source,
        count: v.count,
        won: v.won,
        amount: Math.round(v.amount),
        conversionRate: v.count > 0 ? Math.round((v.won / v.count) * 100 * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getDeals(daysBack = 30, limit = 50, categoryIds?: string[]) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    return this.prisma.bitrixDeal.findMany({
      where: this.dealWhere(since, categoryIds),
      orderBy: { dateCreate: 'desc' },
      take: limit,
      select: {
        bitrixId: true,
        title: true,
        stageId: true,
        stageName: true,
        utmSource: true,
        utmCampaign: true,
        opportunity: true,
        currencyId: true,
        isWon: true,
        isLost: true,
        dateCreate: true,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // POST в Bitrix с ретраями на 429/503 (rate limit) — экспоненциальный backoff
  private async bitrixPost(url: string, body: unknown, tries = 6): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        // Сетевой сбой (fetch failed / ECONNRESET / timeout) — Bitrix периодически рвёт
        // соединение на больших выгрузках. Ретраим с бэкоффом, как и rate limit.
        lastErr = e;
        const wait = Math.min(1500 * 2 ** i, 20000);
        this.logger.warn(`Bitrix сетевая ошибка (${(e as Error).message}), повтор через ${wait}мс (${i + 1}/${tries})`);
        await this.sleep(wait);
        continue;
      }
      if (res.status !== 429 && res.status !== 503) return res;
      const retryAfter = Number(res.headers.get('Retry-After')) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(1500 * 2 ** i, 20000);
      this.logger.warn(`Bitrix ${res.status} (rate limit), повтор через ${wait}мс (${i + 1}/${tries})`);
      await this.sleep(wait);
    }
    if (lastErr) throw new Error(`Bitrix API error: сеть (${(lastErr as Error).message}, исчерпаны ретраи)`);
    throw new Error('Bitrix API error: 429 (исчерпаны ретраи)');
  }

  private async fetchAllDeals(webhookUrl: string): Promise<BitrixDealRaw[]> {
    const deals: BitrixDealRaw[] = [];
    let start = 0;
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];

    while (true) {
      const res = await this.bitrixPost(`${webhookUrl}crm.deal.list.json`, {
        order: { DATE_CREATE: 'DESC' },
        filter: { '>=DATE_CREATE': since },
        select: [
          'ID', 'TITLE', 'STAGE_ID', 'STAGE_SEMANTIC_ID', 'IS_WON', 'CATEGORY_ID', 'SOURCE_ID',
          'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_CONTENT',
          'ASSIGNED_BY_ID', 'OPPORTUNITY', 'CURRENCY_ID',
          'DATE_CREATE', 'DATE_MODIFY', 'CLOSEDATE',
        ],
        start,
      });

      if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);
      const data = (await res.json()) as { result?: BitrixDealRaw[]; next?: number; total?: number };

      deals.push(...(data.result ?? []));
      if (!data.next) break;
      start = data.next;
      await this.sleep(300); // пауза между страницами, чтобы не упираться в rate limit
    }

    return deals;
  }

  private async fetchAllLeads(webhookUrl: string): Promise<BitrixLeadRaw[]> {
    const leads: BitrixLeadRaw[] = [];
    let start = 0;
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];

    while (true) {
      const res = await this.bitrixPost(`${webhookUrl}crm.lead.list.json`, {
        order: { DATE_CREATE: 'DESC' },
        filter: { '>=DATE_CREATE': since },
        select: ['ID', 'TITLE', 'STATUS_ID', 'SOURCE_ID', 'DATE_CREATE', 'DATE_MODIFY'],
        start,
      });
      if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);
      const data = (await res.json()) as { result?: BitrixLeadRaw[]; next?: number };
      leads.push(...(data.result ?? []));
      if (!data.next) break;
      start = data.next;
      await this.sleep(300);
    }
    return leads;
  }

  async getStagesBreakdown(daysBack: number, categoryIds?: string[]) {
    const since = new Date(Date.now() - daysBack * 86_400_000);
    const deals = await this.prisma.bitrixDeal.findMany({
      where: this.dealWhere(since, categoryIds),
      select: { stageId: true, stageName: true, isWon: true, isLost: true },
    });

    const map = new Map<string, { stageId: string; stageName: string; count: number; won: number; lost: number }>();
    for (const d of deals) {
      const key = d.stageName ?? d.stageId;
      const cur = map.get(key) ?? { stageId: d.stageId, stageName: key, count: 0, won: 0, lost: 0 };
      cur.count++;
      if (d.isWon) cur.won++;
      if (d.isLost) cur.lost++;
      map.set(key, cur);
    }

    return {
      total: deals.length,
      stages: [...map.values()].sort((a, b) => b.count - a.count),
    };
  }

  // Читаемое имя стадии. Если из Bitrix пришло нормальное имя — используем его.
  // Иначе (в БД сохранён сырой код вроде UC_LOSE_DATES) — собираем читаемый ярлык.
  private humanizeStage(stageId: string, stageName: string | null, isWon: boolean, isLost: boolean): string {
    if (stageName && stageName !== stageId) return stageName;
    if (isWon) return 'Сделка успешна';
    const base = stageId
      .replace(/^C\d+:/i, '')   // префикс воронки, напр. "C1:"
      .replace(/^UC_/i, '')     // префикс кастомного статуса
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    const pretty = base ? base.charAt(0).toUpperCase() + base.slice(1) : stageId;
    return isLost ? `Отказ — ${pretty}` : pretty;
  }

  private async fetchStages(webhookUrl: string): Promise<BitrixStage[]> {
    // crm.deal.stage.list — стадии воронок;
    // crm.status.list — ВСЕ статусы, включая кастомные причины отказа (UC_LOSE_*),
    // которых нет в stage.list. Объединяем, чтобы у каждого STAGE_ID было имя.
    const post = (method: string, body: unknown) =>
      fetch(`${webhookUrl}${method}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => (r.ok ? r.json() : { result: [] }))
        .then((d) => ((d as { result?: BitrixStage[] }).result ?? []))
        .catch(() => [] as BitrixStage[]);

    const [stageList, statusList] = await Promise.all([
      post('crm.deal.stage.list', {}),
      post('crm.status.list', {}),
    ]);

    const merged = new Map<string, string>();
    // Сначала общий список статусов, затем стадии воронок (приоритетнее) перетирают
    for (const s of statusList) if (s.STATUS_ID && s.NAME) merged.set(s.STATUS_ID, s.NAME);
    for (const s of stageList) if (s.STATUS_ID && s.NAME) merged.set(s.STATUS_ID, s.NAME);
    return Array.from(merged.entries()).map(([STATUS_ID, NAME]) => ({ STATUS_ID, NAME }));
  }

  private async fetchCategories(webhookUrl: string): Promise<BitrixCategory[]> {
    const res = await fetch(`${webhookUrl}crm.dealcategory.list.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: BitrixCategory[] };
    return data.result ?? [];
  }

  async getPipelineStages(daysBack = 90) {
    const since = new Date(Date.now() - daysBack * 86_400_000);
    const SALES_PIPELINES = ['резерв', 'продажа', 'набор в 1 класс'];

    const allDeals = await this.prisma.bitrixDeal.findMany({
      where: { dateCreate: { gte: since } },
      select: { stageId: true, stageName: true, categoryName: true, isWon: true, isLost: true },
    });

    const filtered = allDeals.filter((d) => {
      const name = (d.categoryName ?? '').toLowerCase();
      return SALES_PIPELINES.some((p) => name.includes(p));
    });

    const deals = filtered.length > 0 ? filtered : allDeals;
    const total = deals.length;

    const stageMap = new Map<string, { stageName: string; count: number; isWon: boolean; isLost: boolean }>();
    for (const d of deals) {
      const key = d.stageName ?? d.stageId;
      const cur = stageMap.get(key) ?? { stageName: key, count: 0, isWon: d.isWon, isLost: d.isLost };
      cur.count++;
      stageMap.set(key, cur);
    }

    const stages = [...stageMap.values()]
      .map((s) => ({
        stageName: s.stageName,
        count: s.count,
        percent: total > 0 ? Math.round((s.count / total) * 1000) / 10 : 0,
        isWon: s.isWon,
        isLost: s.isLost,
      }))
      .sort((a, b) => b.count - a.count);

    return { total, stages };
  }

  // Фильтр по воронкам. Если categoryIds задан (проект) — по ним; иначе глобально
  // по названиям воронок продаж (Резерв, продажа, набор в 1 класс) с фолбэком на все.
  async getPipelineFunnel(daysBack = 90, categoryIds?: string[]) {
    const since = new Date(Date.now() - daysBack * 86_400_000);
    const SALES_PIPELINES = ['резерв', 'продажа', 'набор в 1 класс'];

    const allDeals = await this.prisma.bitrixDeal.findMany({
      where: this.dealWhere(since, categoryIds),
      select: { isWon: true, isLost: true, categoryId: true, categoryName: true, opportunity: true },
    });

    let deals = allDeals;
    let isFiltered = categoryIds !== undefined;
    if (categoryIds === undefined) {
      // глобально: по названиям воронок продаж, с фолбэком на все
      const filtered = allDeals.filter((d) =>
        SALES_PIPELINES.some((p) => (d.categoryName ?? '').toLowerCase().includes(p)),
      );
      deals = filtered.length > 0 ? filtered : allDeals;
      isFiltered = filtered.length > 0;
    }

    const won = deals.filter((d) => d.isWon).length;
    const lost = deals.filter((d) => d.isLost).length;
    const inProgress = deals.length - won - lost;
    const totalAmount = deals.filter((d) => d.isWon).reduce((s, d) => s + Number(d.opportunity ?? 0), 0);

    // Breakdown by pipeline
    const byPipeline = new Map<string, { won: number; inProgress: number; total: number }>();
    for (const d of deals) {
      const key = d.categoryName ?? `pipeline_${d.categoryId ?? '0'}`;
      const cur = byPipeline.get(key) ?? { won: 0, inProgress: 0, total: 0 };
      cur.total++;
      if (d.isWon) cur.won++;
      else if (!d.isLost) cur.inProgress++;
      byPipeline.set(key, cur);
    }

    return {
      won,
      inProgress,
      lost,
      totalAmount: Math.round(totalAmount),
      total: deals.length,
      pipelines: [...byPipeline.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
      isFiltered,
    };
  }

  // === Блок «Лиды»: количество лидов (crm.lead), СОЗДАННЫХ за период ===
  async getLeadsSummary(from?: string, to?: string) {
    const now = Date.now();
    const presetDays = [7, 14, 28, 31, 90, 180];
    const presets: Record<string, number> = {};
    for (const d of presetDays) {
      const since = new Date(now - d * 86_400_000);
      presets[`${d}d`] = await this.prisma.bitrixLead.count({ where: { dateCreate: { gte: since } } });
    }
    const total = await this.prisma.bitrixLead.count();

    let custom: { from: string; to: string; count: number } | null = null;
    if (from && to) {
      const f = new Date(from);
      const t = new Date(`${to}T23:59:59`);
      const count = await this.prisma.bitrixLead.count({ where: { dateCreate: { gte: f, lte: t } } });
      custom = { from, to, count };
    }

    return { presets, custom, total };
  }

  // === Блок «Сделки»: 6 воронок продаж, каждая отдельно ===
  // total — всего сделок в воронке; newInPeriod — созданных за период; stages — drill-down по статусам.
  private static readonly SALES_FUNNELS: { id: string; name: string }[] = [
    { id: '28', name: 'Резерв' },
    { id: '52', name: '2026-2027 набор в 1 класс' },
    { id: '48', name: '1.Продажа' },
    { id: '0', name: 'Набор в школу' },
    { id: '56', name: 'Школа Пансион' },
    { id: '58', name: 'Лагерь — сделки' },
  ];

  async getSalesFunnels(from?: string, to?: string) {
    const ids = BitrixService.SALES_FUNNELS.map((f) => f.id);
    const fromDate = from ? new Date(from) : new Date(Date.now() - 28 * 86_400_000);
    const toDate = to ? new Date(`${to}T23:59:59`) : new Date();

    const deals = await this.prisma.bitrixDeal.findMany({
      where: { categoryId: { in: ids } },
      select: { categoryId: true, stageId: true, stageName: true, dateCreate: true, isWon: true, isLost: true },
    });

    const funnels = BitrixService.SALES_FUNNELS.map(({ id, name }) => {
      const fd = deals.filter((d) => (d.categoryId ?? '0') === id);
      const total = fd.length;
      const newInPeriod = fd.filter((d) => d.dateCreate >= fromDate && d.dateCreate <= toDate).length;

      const stageMap = new Map<string, { stageId: string; stageName: string; count: number; isWon: boolean; isLost: boolean }>();
      for (const d of fd) {
        const cur = stageMap.get(d.stageId) ?? {
          stageId: d.stageId,
          stageName: this.humanizeStage(d.stageId, d.stageName, d.isWon, d.isLost),
          count: 0,
          isWon: d.isWon,
          isLost: d.isLost,
        };
        cur.count++;
        stageMap.set(d.stageId, cur);
      }
      const stages = [...stageMap.values()].sort((a, b) => b.count - a.count);

      return { categoryId: id, name, total, newInPeriod, stages };
    });

    return {
      period: { from: fromDate.toISOString().split('T')[0], to: toDate.toISOString().split('T')[0] },
      funnels,
    };
  }
}
