import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Принудительные правила (ТЗ §14.5: «единообразные метки»)
export const ALLOWED_SOURCES = [
  'instagram', 'youtube', 'facebook', 'tiktok', 'telegram',
  'whatsapp', 'email', 'direct', 'google', 'yandex',
];
export const ALLOWED_MEDIUMS = [
  'organic', 'cpc', 'social', 'email', 'referral', 'video', 'banner', 'sms', 'qr',
];

const SAFE_TOKEN = /^[a-z0-9_-]+$/; // принудительно lowercase + только safe-символы

export type CreateUtmInput = {
  label: string;
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
  projectId?: string;
};

@Injectable()
export class UtmService {
  constructor(private readonly prisma: PrismaService) {}

  list(opts: { limit?: number; projectId?: string } = {}) {
    return this.prisma.utmLink.findMany({
      where: opts.projectId ? { projectId: opts.projectId } : undefined,
      take: opts.limit ?? 50,
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { slug: true, name: true } } },
    });
  }

  async create(input: CreateUtmInput, userId?: string) {
    this.validate(input);
    const url = this.buildUrl(input);

    return this.prisma.utmLink.create({
      data: {
        label: input.label,
        baseUrl: input.baseUrl,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        content: input.content,
        term: input.term,
        projectId: input.projectId,
        createdById: userId,
        generatedUrl: url,
      },
      include: { project: { select: { slug: true, name: true } } },
    });
  }

  async remove(id: string) {
    try {
      await this.prisma.utmLink.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException();
    }
  }

  // Превью URL без сохранения (для live-preview в UI)
  preview(input: CreateUtmInput): { url: string; warnings: string[] } {
    const warnings: string[] = [];
    try {
      this.validate(input);
    } catch (e) {
      throw e;
    }
    if (input.campaign !== input.campaign.toLowerCase()) {
      warnings.push('campaign будет приведён к нижнему регистру');
    }
    return { url: this.buildUrl(input), warnings };
  }

  private validate(input: CreateUtmInput) {
    if (!input.label || input.label.length < 3) {
      throw new BadRequestException('Название (label) должно быть не короче 3 символов');
    }
    if (!/^https?:\/\//i.test(input.baseUrl)) {
      throw new BadRequestException('baseUrl должен начинаться с http(s)://');
    }
    if (!ALLOWED_SOURCES.includes(input.source)) {
      throw new BadRequestException(
        `source должен быть из списка: ${ALLOWED_SOURCES.join(', ')}`,
      );
    }
    if (!ALLOWED_MEDIUMS.includes(input.medium)) {
      throw new BadRequestException(
        `medium должен быть из списка: ${ALLOWED_MEDIUMS.join(', ')}`,
      );
    }
    if (!input.campaign || !SAFE_TOKEN.test(input.campaign.toLowerCase())) {
      throw new BadRequestException(
        'campaign: только латиница строчная, цифры, дефис, подчёркивание',
      );
    }
    for (const opt of ['content', 'term'] as const) {
      const v = input[opt];
      if (v && !SAFE_TOKEN.test(v.toLowerCase())) {
        throw new BadRequestException(
          `${opt}: только латиница строчная, цифры, дефис, подчёркивание`,
        );
      }
    }
  }

  private buildUrl(input: CreateUtmInput): string {
    const url = new URL(input.baseUrl);
    url.searchParams.set('utm_source', input.source);
    url.searchParams.set('utm_medium', input.medium);
    url.searchParams.set('utm_campaign', input.campaign.toLowerCase());
    if (input.content) url.searchParams.set('utm_content', input.content.toLowerCase());
    if (input.term) url.searchParams.set('utm_term', input.term.toLowerCase());
    return url.toString();
  }
}
