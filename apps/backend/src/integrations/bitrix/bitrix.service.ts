import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../crypto.service';
import { Decimal } from '@prisma/client/runtime/library';

interface BitrixDealRaw {
  ID: string;
  TITLE: string;
  STAGE_ID: string;
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

interface BitrixStage {
  STATUS_ID: string;
  NAME: string;
  CATEGORY_ID?: string;
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

  async sync(): Promise<{ synced: number; errors: number }> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) throw new BadRequestException('Bitrix24 webhook not configured');

    const start = Date.now();
    let synced = 0;
    let errors = 0;

    try {
      const [deals, stages] = await Promise.all([
        this.fetchAllDeals(webhookUrl),
        this.fetchStages(webhookUrl),
      ]);

      const stageMap = new Map<string, string>(stages.map((s) => [s.STATUS_ID, s.NAME]));

      for (const d of deals) {
        try {
          const isWon = d.IS_WON === 'Y';
          const isLost = !isWon && /LOSE|LOST|UC_LOSE/i.test(d.STAGE_ID);

          await this.prisma.bitrixDeal.upsert({
            where: { bitrixId: parseInt(d.ID) },
            update: {
              title: d.TITLE,
              stageId: d.STAGE_ID,
              stageName: stageMap.get(d.STAGE_ID) ?? d.STAGE_ID,
              categoryId: d.CATEGORY_ID ?? null,
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

      await this.prisma.bitrixConfig.updateMany({ data: { lastSyncAt: new Date() } });

      await this.prisma.integrationLog.create({
        data: {
          source: 'bitrix24',
          operation: 'sync',
          status: 'SUCCESS',
          durationMs: Date.now() - start,
        },
      });

      this.logger.log(`Bitrix24 sync complete: ${synced} deals, ${errors} errors`);
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
    }

    return { synced, errors };
  }

  async getFunnel(daysBack = 30) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const deals = await this.prisma.bitrixDeal.findMany({
      where: { dateCreate: { gte: since } },
      select: { stageId: true, stageName: true, isWon: true, isLost: true, opportunity: true },
    });

    const stageMap = new Map<string, { count: number; amount: number; stageName: string; isWon: boolean; isLost: boolean }>();

    for (const d of deals) {
      const key = d.stageId;
      const name = d.stageName ?? d.stageId;
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

  async getSources(daysBack = 30) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const deals = await this.prisma.bitrixDeal.findMany({
      where: { dateCreate: { gte: since } },
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

  async getDeals(daysBack = 30, limit = 50) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    return this.prisma.bitrixDeal.findMany({
      where: { dateCreate: { gte: since } },
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

  private async fetchAllDeals(webhookUrl: string): Promise<BitrixDealRaw[]> {
    const deals: BitrixDealRaw[] = [];
    let start = 0;
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];

    while (true) {
      const res = await fetch(`${webhookUrl}crm.deal.list.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: { DATE_CREATE: 'DESC' },
          filter: { '>=DATE_CREATE': since },
          select: [
            'ID', 'TITLE', 'STAGE_ID', 'IS_WON', 'CATEGORY_ID', 'SOURCE_ID',
            'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN', 'UTM_CONTENT',
            'ASSIGNED_BY_ID', 'OPPORTUNITY', 'CURRENCY_ID',
            'DATE_CREATE', 'DATE_MODIFY', 'CLOSEDATE',
          ],
          start,
        }),
      });

      if (!res.ok) throw new Error(`Bitrix API error: ${res.status}`);
      const data = (await res.json()) as { result?: BitrixDealRaw[]; next?: number; total?: number };

      deals.push(...(data.result ?? []));
      if (!data.next) break;
      start = data.next;
    }

    return deals;
  }

  private async fetchStages(webhookUrl: string): Promise<BitrixStage[]> {
    const res = await fetch(`${webhookUrl}crm.deal.stage.list.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: BitrixStage[] };
    return data.result ?? [];
  }
}
