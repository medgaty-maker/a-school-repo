import { Body, Controller, Get, Post, Put, Query, Logger } from '@nestjs/common';
import { IsString, IsUrl } from 'class-validator';
import { BitrixService } from './bitrix.service';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

class SetWebhookDto {
  @IsString()
  @IsUrl()
  url!: string;
}

@Controller('bitrix')
export class BitrixController {
  private readonly logger = new Logger(BitrixController.name);
  constructor(private readonly bitrix: BitrixService) {}

  @Get('status')
  status() {
    return this.bitrix.getStatus();
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Put('config')
  setWebhook(@Body() dto: SetWebhookDto) {
    return this.bitrix.setWebhookUrl(dto.url);
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Post('sync')
  sync() {
    if (this.bitrix.isSyncing()) return { started: false, running: true };
    // Запускаем в фоне: синк 29k сделок длится дольше таймаута Cloudflare (524).
    // Кнопка получает мгновенный ответ, результат смотрим по lastSyncAt / данным.
    this.bitrix.sync().catch((e) => this.logger.error(`Bitrix sync failed: ${(e as Error).message}`));
    return { started: true, running: true };
  }

  // Список воронок Bitrix (для UI привязки к проектам)
  @Get('categories')
  categories() {
    return this.bitrix.getCategories();
  }

  @Get('funnel')
  async funnel(@Query('days') days?: string, @Query('project') project?: string) {
    const cat = await this.bitrix.resolveProjectCategoryIds(project);
    return this.bitrix.getFunnel(days ? parseInt(days, 10) : 30, cat);
  }

  @Get('sources')
  async sources(@Query('days') days?: string, @Query('project') project?: string) {
    const cat = await this.bitrix.resolveProjectCategoryIds(project);
    return this.bitrix.getSources(days ? parseInt(days, 10) : 30, cat);
  }

  @Get('deals')
  async deals(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('project') project?: string,
  ) {
    const cat = await this.bitrix.resolveProjectCategoryIds(project);
    return this.bitrix.getDeals(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 50,
      cat,
    );
  }

  @Get('stages-breakdown')
  async stagesBreakdown(@Query('days') days?: string, @Query('project') project?: string) {
    const cat = await this.bitrix.resolveProjectCategoryIds(project);
    return this.bitrix.getStagesBreakdown(days ? parseInt(days, 10) : 90, cat);
  }

  @Get('pipeline-funnel')
  async pipelineFunnel(@Query('days') days?: string, @Query('project') project?: string) {
    const cat = await this.bitrix.resolveProjectCategoryIds(project);
    return this.bitrix.getPipelineFunnel(days ? parseInt(days, 10) : 90, cat);
  }

  @Get('pipeline-stages')
  pipelineStages(@Query('days') days?: string) {
    return this.bitrix.getPipelineStages(days ? parseInt(days, 10) : 90);
  }
}
