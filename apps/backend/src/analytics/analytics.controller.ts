import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('health')
  health() {
    return this.analytics.getHealth();
  }

  @Get('funnel')
  funnel(@Query('days') days?: string, @Query('project') project?: string) {
    return this.analytics.getFunnel(days ? parseInt(days, 10) : 30, project);
  }
}
