import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Platform, ProjectPriority } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({
      where: { isActive: true },
      include: {
        platforms: {
          select: {
            id: true,
            platform: true,
            externalAccountId: true,
            externalAccountName: true,
            status: true,
            lastSyncAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBySlug(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: { platforms: true },
    });
    if (!project) throw new NotFoundException();
    return project;
  }

  update(id: string, data: { name?: string; description?: string; priority?: ProjectPriority }) {
    return this.prisma.project.update({ where: { id }, data });
  }

  // Привязка источников данных к проекту (ID через запятую; пустая строка → очистить)
  updateSources(
    slug: string,
    data: { bitrixCategoryIds?: string; metricaCounterIds?: string; metaCampaignIds?: string },
  ) {
    const norm = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    return this.prisma.project.update({
      where: { slug },
      data: {
        bitrixCategoryIds: norm(data.bitrixCategoryIds),
        metricaCounterIds: norm(data.metricaCounterIds),
        metaCampaignIds: norm(data.metaCampaignIds),
      },
    });
  }

  static periodToDays(period: string | undefined): number {
    switch (period) {
      case 'today':
      case 'yesterday':
        return 1;
      case '7d': return 7;
      case '30d': return 30;
      case 'quarter': return 90;
      case 'year': return 365;
      default: return 30;
    }
  }

  /**
   * Агрегированные метрики проекта по всем платформам.
   * Возвращает: последние значения метрик + динамика по дням за `daysBack` дней.
   */
  async getMetrics(slug: string, daysBack = 30) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: { platforms: true },
    });
    if (!project) throw new NotFoundException();

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const platformMetrics: Record<string, any> = {};

    for (const pp of project.platforms) {
      if (pp.status !== 'ACTIVE') {
        platformMetrics[pp.platform] = { projectPlatformId: pp.id, status: pp.status, metrics: {}, series: [] };
        continue;
      }

      // Последние снапшоты по каждой ключевой метрике
      const latest = await this.prisma.$queryRaw<Array<{ metricKey: string; metricValue: string; capturedAt: Date }>>`
        SELECT DISTINCT ON ("metricKey") "metricKey", "metricValue", "capturedAt"
        FROM "Snapshot"
        WHERE "projectPlatformId" = ${pp.id}
        ORDER BY "metricKey", "capturedAt" DESC
      `;

      // Серия для графиков: views_28d или просмотры по дням
      const series = await this.prisma.snapshot.findMany({
        where: {
          projectPlatformId: pp.id,
          capturedAt: { gte: since },
          metricKey: { in: ['views_28d', 'views_total', 'subscribers_total'] },
        },
        select: { metricKey: true, metricValue: true, capturedAt: true },
        orderBy: { capturedAt: 'asc' },
      });

      const metrics: Record<string, number> = {};
      for (const m of latest) {
        metrics[m.metricKey] = Number(m.metricValue);
      }

      platformMetrics[pp.platform] = {
        projectPlatformId: pp.id,
        status: pp.status,
        externalAccountId: pp.externalAccountId,
        externalAccountName: pp.externalAccountName,
        lastSyncAt: pp.lastSyncAt,
        metrics,
        series: series.map((s) => ({
          metricKey: s.metricKey,
          value: Number(s.metricValue),
          capturedAt: s.capturedAt,
        })),
      };
    }

    // Гарантируем все 4 платформы (даже если их нет в БД — но они есть из сидера)
    for (const platform of Object.values(Platform)) {
      if (!platformMetrics[platform]) {
        platformMetrics[platform] = {
          status: 'NOT_CONNECTED',
          metrics: {},
          series: [],
        };
      }
    }

    return {
      project: {
        id: project.id,
        slug: project.slug,
        name: project.name,
        description: project.description,
        priority: project.priority,
      },
      platforms: platformMetrics,
      period: { since, daysBack },
    };
  }
}
