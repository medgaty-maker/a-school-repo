import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
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
    return this.bitrix.sync();
  }

  @Get('funnel')
  funnel(@Query('days') days?: string) {
    return this.bitrix.getFunnel(days ? parseInt(days, 10) : 30);
  }

  @Get('sources')
  sources(@Query('days') days?: string) {
    return this.bitrix.getSources(days ? parseInt(days, 10) : 30);
  }

  @Get('deals')
  deals(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.bitrix.getDeals(
      days ? parseInt(days, 10) : 30,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('stages-breakdown')
  stagesBreakdown(@Query('days') days?: string) {
    return this.bitrix.getStagesBreakdown(days ? parseInt(days, 10) : 90);
  }
}
