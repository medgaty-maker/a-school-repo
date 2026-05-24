import { Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SnapshotsService } from './snapshots.service';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('snapshots')
export class SnapshotsController {
  constructor(
    private readonly snapshots: SnapshotsService,
    private readonly prisma: PrismaService,
  ) {}

  // Запустить все ETL-задачи вручную (для Этапа 1 — отладка)
  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Post('run')
  run() {
    return this.snapshots.runAll();
  }

  @Get()
  list(
    @Query('projectPlatformId') projectPlatformId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.snapshot.findMany({
      where: {
        projectPlatformId,
        metricKey,
      },
      orderBy: { capturedAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });
  }
}
