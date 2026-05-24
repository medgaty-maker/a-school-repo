import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeService } from '../integrations/youtube/youtube.service';
import { MetaService } from '../integrations/meta/meta.service';
import { IntegrationStatus, Platform } from '@prisma/client';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeService,
    private readonly meta: MetaService,
  ) {}

  // ТЗ §3.2: соцсети — раз в 6 часов
  @Cron(CronExpression.EVERY_6_HOURS, { name: 'snapshot-social' })
  async runScheduled() {
    this.logger.log('Cron: snapshot-social start');
    await this.runAll();
    this.logger.log('Cron: snapshot-social done');
  }

  async runAll() {
    const platforms = await this.prisma.projectPlatform.findMany({
      where: { status: IntegrationStatus.ACTIVE },
      include: { project: true },
    });

    let success = 0;
    let failed = 0;

    for (const pp of platforms) {
      try {
        if (pp.platform === Platform.YOUTUBE) {
          await this.youtube.captureSnapshot(pp.id);
          success++;
        } else if (pp.platform === Platform.INSTAGRAM) {
          await this.meta.captureInstagramSnapshot(pp.id);
          success++;
        }
        // FACEBOOK/TIKTOK — Этап 2 (ТЗ §17)
      } catch (e) {
        failed++;
        this.logger.error(`Snapshot ${pp.platform} for ${pp.project.slug} failed: ${(e as Error).message}`);
      }
    }

    return { total: platforms.length, success, failed };
  }
}
