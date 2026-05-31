import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { YandexMetricaService } from './yandex-metrica.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations/yandex-metrica')
export class YandexMetricaController {
  constructor(private readonly svc: YandexMetricaService) {}

  @Get('config')
  getConfig() {
    return this.svc.getConfig();
  }

  @Post('config')
  setConfig(@Body() body: { token: string; counterIds: string }) {
    return this.svc.setConfig(body.token, body.counterIds);
  }

  @Get('leads')
  getLeads(@Query('datePreset') datePreset?: string) {
    return this.svc.getLeads(datePreset ?? 'last_28d');
  }

  @Get('visits-daily')
  getDailyVisits(@Query('datePreset') datePreset?: string) {
    return this.svc.getDailyVisits(datePreset ?? 'last_28d');
  }

  @Get('ai-insights')
  getAiInsights() {
    return this.svc.getAiInsights();
  }
}
