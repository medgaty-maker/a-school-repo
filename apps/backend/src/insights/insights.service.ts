import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationStatus } from '@prisma/client';

export type Insight = {
  id: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  category: 'sync' | 'growth' | 'engagement' | 'audience';
  title: string;
  description: string;
  projectSlug?: string;
  projectName?: string;
  platform?: string;
  detectedAt: string;
};

const STALE_SYNC_HOURS = 24;
const GROWTH_SIGNIFICANT_PCT = 5;
const DROP_WARNING_PCT = -20;
const DROP_DANGER_PCT = -40;

const COMPARE_METRICS = ['subscribers_total', 'views_28d'];
const ALL_METRICS = [...COMPARE_METRICS, 'avg_view_percentage_28d'];

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

    const platforms = await this.prisma.projectPlatform.findMany({
      include: { project: { select: { slug: true, name: true } } },
    });

    const activePpIds = platforms
      .filter((p) => p.status === IntegrationStatus.ACTIVE)
      .map((p) => p.id);

    // Batch-загрузка всех нужных снапшотов за 2 запроса вместо N×M
    const [currentRows, prevRows] = await Promise.all([
      activePpIds.length
        ? this.prisma.snapshot.findMany({
            where: {
              projectPlatformId: { in: activePpIds },
              metricKey: { in: ALL_METRICS },
              capturedAt: { gte: weekAgo },
            },
            orderBy: { capturedAt: 'desc' },
            select: { projectPlatformId: true, metricKey: true, metricValue: true },
          })
        : Promise.resolve([]),
      activePpIds.length
        ? this.prisma.snapshot.findMany({
            where: {
              projectPlatformId: { in: activePpIds },
              metricKey: { in: COMPARE_METRICS },
              capturedAt: { gte: twoWeeksAgo, lt: weekAgo },
            },
            orderBy: { capturedAt: 'desc' },
            select: { projectPlatformId: true, metricKey: true, metricValue: true },
          })
        : Promise.resolve([]),
    ]);

    // Группируем: берём первый (самый свежий) для каждой пары ppId+metricKey
    const current = groupLatest(currentRows);
    const prev = groupLatest(prevRows);

    for (const pp of platforms) {
      // 1. Устаревшие данные
      if (pp.status === IntegrationStatus.ACTIVE && pp.lastSyncAt) {
        const ageHours = (now.getTime() - pp.lastSyncAt.getTime()) / 3_600_000;
        if (ageHours > STALE_SYNC_HOURS) {
          insights.push({
            id: `stale:${pp.id}`,
            severity: 'warning',
            category: 'sync',
            title: 'Данные устарели',
            description: `${pp.platform} (${pp.externalAccountName ?? '—'}) не синкался ${Math.round(ageHours)}ч. Норма — каждые 6ч.`,
            projectSlug: pp.project.slug,
            projectName: pp.project.name,
            platform: pp.platform,
            detectedAt: now.toISOString(),
          });
        }
      }

      // 2. Ошибка синхронизации
      if (pp.status === IntegrationStatus.ERROR) {
        insights.push({
          id: `error:${pp.id}`,
          severity: 'danger',
          category: 'sync',
          title: 'Ошибка синхронизации',
          description: `${pp.platform}: ${pp.lastError ?? 'неизвестная ошибка'}. Проверьте подключение.`,
          projectSlug: pp.project.slug,
          projectName: pp.project.name,
          platform: pp.platform,
          detectedAt: now.toISOString(),
        });
      }

      if (pp.status !== IntegrationStatus.ACTIVE) continue;

      // 3. Рост/падение метрик (из батч-данных)
      for (const metricKey of COMPARE_METRICS) {
        const curVal = current.get(`${pp.id}:${metricKey}`);
        const prvVal = prev.get(`${pp.id}:${metricKey}`);
        if (curVal == null || prvVal == null || prvVal === 0) continue;

        const deltaPct = ((curVal - prvVal) / prvVal) * 100;
        if (Math.abs(deltaPct) < GROWTH_SIGNIFICANT_PCT) continue;

        const niceName = metricKey === 'views_28d' ? 'Просмотры за 28 дней' : 'Подписчики';

        if (deltaPct >= GROWTH_SIGNIFICANT_PCT) {
          insights.push({
            id: `growth:${pp.id}:${metricKey}`,
            severity: 'success',
            category: 'growth',
            title: `Рост: ${niceName} +${deltaPct.toFixed(1)}%`,
            description: `${pp.platform} (${pp.externalAccountName ?? '—'}): с ${formatNum(prvVal)} до ${formatNum(curVal)} за неделю.`,
            projectSlug: pp.project.slug,
            projectName: pp.project.name,
            platform: pp.platform,
            detectedAt: now.toISOString(),
          });
        } else if (deltaPct <= DROP_DANGER_PCT) {
          insights.push({
            id: `drop:${pp.id}:${metricKey}`,
            severity: 'danger',
            category: 'growth',
            title: `Резкое падение: ${niceName} ${deltaPct.toFixed(1)}%`,
            description: `${pp.platform}: с ${formatNum(prvVal)} до ${formatNum(curVal)} за неделю. Требует внимания.`,
            projectSlug: pp.project.slug,
            projectName: pp.project.name,
            platform: pp.platform,
            detectedAt: now.toISOString(),
          });
        } else if (deltaPct <= DROP_WARNING_PCT) {
          insights.push({
            id: `warn:${pp.id}:${metricKey}`,
            severity: 'warning',
            category: 'growth',
            title: `Снижение: ${niceName} ${deltaPct.toFixed(1)}%`,
            description: `${pp.platform}: с ${formatNum(prvVal)} до ${formatNum(curVal)}.`,
            projectSlug: pp.project.slug,
            projectName: pp.project.name,
            platform: pp.platform,
            detectedAt: now.toISOString(),
          });
        }
      }

      // 4. Низкое удержание (из батч-данных)
      const retention = current.get(`${pp.id}:avg_view_percentage_28d`);
      if (retention != null && retention < 30 && retention > 0) {
        insights.push({
          id: `retention:${pp.id}`,
          severity: 'warning',
          category: 'engagement',
          title: 'Низкое удержание аудитории',
          description: `${pp.platform}: среднее удержание ${retention.toFixed(1)}%. Ниже 30% — слабый сигнал YouTube.`,
          projectSlug: pp.project.slug,
          projectName: pp.project.name,
          platform: pp.platform,
          detectedAt: now.toISOString(),
        });
      }
    }

    if (insights.length === 0) {
      const activeCount = platforms.filter((p) => p.status === IntegrationStatus.ACTIVE).length;
      if (activeCount > 0) {
        insights.push({
          id: 'health:ok',
          severity: 'success',
          category: 'sync',
          title: 'Все системы в норме',
          description: `${activeCount} интеграций активны. Свежие данные, без аномалий.`,
          detectedAt: now.toISOString(),
        });
      }
    }

    const order = { danger: 0, warning: 1, success: 2, info: 3 };
    insights.sort((a, b) => order[a.severity] - order[b.severity]);

    return insights;
  }
}

function groupLatest(
  rows: Array<{ projectPlatformId: string; metricKey: string; metricValue: any }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.projectPlatformId}:${r.metricKey}`;
    if (!map.has(key)) map.set(key, Number(r.metricValue));
  }
  return map;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return new Intl.NumberFormat('ru-RU').format(n);
}
