import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BitrixService } from '../integrations/bitrix/bitrix.service';
import { KabinetyService } from '../integrations/kabinety/kabinety.service';

type HealthItem = {
  source: string;
  connected: boolean;
  lastSyncAt: string | null;
  staleHours: number | null;
  status: 'ok' | 'stale' | 'error' | 'off';
  note?: string;
  tokenDaysLeft?: number | null;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitrix: BitrixService,
    private readonly kabinety: KabinetyService,
  ) {}

  private hoursSince(d: Date | null | undefined): number | null {
    if (!d) return null;
    return Math.round((Date.now() - new Date(d).getTime()) / 3_600_000);
  }

  // Панель здоровья: что подключено, когда синкалось, свежесть, срок токенов.
  async getHealth() {
    const items: HealthItem[] = [];

    const bitrixCfg = await this.prisma.bitrixConfig.findFirst();
    {
      const h = this.hoursSince(bitrixCfg?.lastSyncAt);
      items.push({
        source: 'Bitrix24 (CRM)',
        connected: !!bitrixCfg,
        lastSyncAt: bitrixCfg?.lastSyncAt?.toISOString() ?? null,
        staleHours: h,
        status: !bitrixCfg ? 'off' : h == null ? 'error' : h > 3 ? 'stale' : 'ok',
        note: 'синк каждый час',
      });
    }

    const metricaCfg = await this.prisma.yandexMetricaConfig.findFirst();
    {
      const h = this.hoursSince(metricaCfg?.lastSyncAt);
      items.push({
        source: 'Яндекс.Метрика',
        connected: !!metricaCfg,
        lastSyncAt: metricaCfg?.lastSyncAt?.toISOString() ?? null,
        staleHours: h,
        status: !metricaCfg ? 'off' : 'ok',
        note: 'живой API',
      });
    }

    const metaCfg = await this.prisma.metaConfig.findFirst();
    {
      const h = this.hoursSince(metaCfg?.lastSyncAt);
      items.push({
        source: 'Meta Ads',
        connected: !!metaCfg,
        lastSyncAt: metaCfg?.lastSyncAt?.toISOString() ?? null,
        staleHours: h,
        status: !metaCfg ? 'off' : h != null && h > 48 ? 'stale' : 'ok',
        note: 'токен пользователя — истекает ~раз в 60 дней',
      });
    }

    // Соцсети/платформы по проектам
    const pps = await this.prisma.projectPlatform.findMany({
      where: { status: { not: 'NOT_CONNECTED' } },
      include: { project: { select: { name: true, slug: true } } },
      orderBy: [{ projectId: 'asc' }],
    });
    for (const pp of pps) {
      const h = this.hoursSince(pp.lastSyncAt);
      // tokenExpiresAt осмысленен только для Instagram (60-дневный токен).
      // У YouTube это короткий access-токен (~1ч) — обновляется кроном, отсчёт не показываем.
      const tokenDaysLeft = pp.platform === 'INSTAGRAM' && pp.tokenExpiresAt
        ? Math.round((new Date(pp.tokenExpiresAt).getTime() - Date.now()) / 86_400_000)
        : null;
      let status: HealthItem['status'] = 'ok';
      if (pp.status === 'EXPIRED' || pp.status === 'ERROR') status = 'error';
      else if (tokenDaysLeft != null && tokenDaysLeft <= 7) status = 'stale';
      else if (h != null && h > 48) status = 'stale';
      items.push({
        source: `${pp.project.name} · ${pp.platform}`,
        connected: pp.status === 'ACTIVE',
        lastSyncAt: pp.lastSyncAt?.toISOString() ?? null,
        staleHours: h,
        status,
        tokenDaysLeft,
        note: pp.lastError ?? undefined,
      });
    }

    const problems = items.filter((i) => i.status === 'error' || i.status === 'stale').length;
    return { items, problems, checkedAt: new Date().toISOString() };
  }

  // Сквозная воронка привлечения: Лиды → Сделки → Продажи → Зачисления + конверсии, юнит-экономика,
  // сравнение с прошлым периодом, разбивка продаж по воронкам и авто-сигналы.
  async getFunnel(daysBack = 30, projectSlug?: string) {
    const categoryIds = await this.bitrix.resolveProjectCategoryIds(projectSlug);
    const now = new Date();
    const since = new Date(now.getTime() - daysBack * 86_400_000);
    const prevSince = new Date(since.getTime() - daysBack * 86_400_000);
    const [bf, prev] = await Promise.all([
      this.bitrix.getAttractionWindow(since, now, categoryIds),
      this.bitrix.getAttractionWindow(prevSince, since, categoryIds),
    ]);

    // Зачисления — из системы кабинетов (только когда смотрим a-school или без фильтра)
    let enrolled: number | null = null;
    let enrolledNew: number | null = null;
    if (!projectSlug || projectSlug === 'a-school') {
      try {
        const k = await this.kabinety.getSummary();
        enrolled = k.total;
        enrolledNew = k.newStudents;
      } catch { /* kabinety недоступен — пропускаем этап */ }
    }

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    // Показываем только осмысленные конверсии. Лиды и Сделки — параллельные каналы входа
    // (часть обращений заводится сразу сделкой, минуя лид), поэтому «лид→сделка» не считаем.
    // Реальная конверсия — «сделка→продажа». Зачисления — отдельный итог из kabinety.
    const stages: Array<{ key: string; label: string; value: number; convFromPrev: number | null; note?: string }> = [
      { key: 'leads', label: 'Лиды', value: bf.leads, convFromPrev: null, note: 'crm.lead за период' },
      { key: 'deals', label: 'Новые сделки', value: bf.deals, convFromPrev: null, note: 'продажные воронки, вход параллельно с лидами' },
      { key: 'sales', label: 'Продажи', value: bf.sales, convFromPrev: pct(bf.sales, bf.deals), note: 'конверсия сделка→продажа' },
    ];
    if (enrolledNew != null) {
      stages.push({ key: 'enrolled', label: 'Зачислены (новые)', value: enrolledNew, convFromPrev: null, note: 'kabinety, всего в школе' });
    }

    const avgCheck = bf.sales > 0 ? Math.round(bf.revenue / bf.sales) : 0;
    const prevAvgCheck = prev.sales > 0 ? Math.round(prev.revenue / prev.sales) : 0;

    // дельты к прошлому периоду (%)
    const delta = (cur: number, p: number) => (p > 0 ? Math.round((cur / p - 1) * 1000) / 10 : null);
    const deltas = {
      leads: delta(bf.leads, prev.leads),
      deals: delta(bf.deals, prev.deals),
      sales: delta(bf.sales, prev.sales),
      revenue: delta(bf.revenue, prev.revenue),
      avgCheck: delta(avgCheck, prevAvgCheck),
    };

    // Авто-сигналы: на что обратить внимание
    const signals: Array<{ level: 'danger' | 'warning' | 'info'; text: string }> = [];
    if (deltas.sales != null && deltas.sales <= -25) signals.push({ level: 'danger', text: `Продажи упали на ${Math.abs(deltas.sales)}% к прошлому периоду (${bf.sales} против ${prev.sales})` });
    if (deltas.leads != null && deltas.leads <= -25) signals.push({ level: 'warning', text: `Лидов меньше на ${Math.abs(deltas.leads)}% к прошлому периоду` });
    const c2s = pct(bf.sales, bf.deals);
    if (c2s != null && c2s < 5) signals.push({ level: 'warning', text: `Низкая конверсия сделка→продажа: ${c2s}% (сделок ${bf.deals}, продаж ${bf.sales})` });
    if (deltas.revenue != null && deltas.revenue >= 25) signals.push({ level: 'info', text: `Выручка выросла на ${deltas.revenue}% к прошлому периоду` });
    // риски токенов — из health
    try {
      const health = await this.getHealth();
      for (const it of health.items) {
        if (it.tokenDaysLeft != null && it.tokenDaysLeft > 0 && it.tokenDaysLeft <= 14) {
          signals.push({ level: 'warning', text: `${it.source}: токен истекает через ${it.tokenDaysLeft} дн.` });
        }
        if (it.status === 'error') signals.push({ level: 'danger', text: `${it.source}: ${it.note ?? 'источник не отвечает / токен истёк'}` });
      }
    } catch { /* health недоступен — пропускаем */ }

    return {
      daysBack,
      stages,
      revenue: bf.revenue,
      avgCheck,
      leadToSale: pct(bf.sales, bf.leads),
      enrolledTotal: enrolled,
      deltas,
      salesByFunnel: bf.salesByFunnel,
      signals,
    };
  }
}
