import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { MetaService } from './meta.service';
import { Roles } from '../../auth/roles.decorator';
import { Public } from '../../auth/public.decorator';

class SetMetaConfigDto {
  @IsString()
  accessToken!: string;

  @IsString()
  adAccountId!: string;

  @IsOptional()
  @IsString()
  appId?: string;
}

@Controller('integrations/meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  // ─── Meta Ads (System User Token) ───────────────────────────────────────────

  @Get('status')
  status() {
    return this.meta.getStatus();
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Put('config')
  setConfig(@Body() dto: SetMetaConfigDto) {
    return this.meta.setConfig(dto.accessToken, dto.adAccountId, dto.appId);
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Delete('config')
  deleteConfig() {
    return this.meta.deleteConfig();
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Post('test')
  testConnection() {
    return this.meta.testConnection();
  }

  @Get('ads/insights')
  getInsights(@Query('datePreset') datePreset?: string) {
    return this.meta.getAdInsights(datePreset ?? 'last_28d');
  }

  @Get('ads/campaigns')
  getCampaigns(@Query('datePreset') datePreset?: string) {
    return this.meta.getCampaigns(datePreset ?? 'last_28d');
  }

  @Get('ads/campaigns/:campaignId/ads')
  getCampaignAds(
    @Param('campaignId') campaignId: string,
    @Query('datePreset') datePreset?: string,
  ) {
    return this.meta.getCampaignAds(campaignId, datePreset ?? 'last_28d');
  }

  // ─── Instagram OAuth ─────────────────────────────────────────────────────────

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR, Role.DIRECTOR, Role.SMM)
  @Get('instagram/oauth/url/:projectPlatformId')
  getInstagramAuthUrl(@Param('projectPlatformId') projectPlatformId: string) {
    return { url: this.meta.buildInstagramAuthUrl(projectPlatformId) };
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR, Role.DIRECTOR, Role.SMM)
  @Get('instagram/oauth/start/:projectPlatformId')
  startInstagram(
    @Param('projectPlatformId') projectPlatformId: string,
    @Res() res: Response,
    @Query('bearer') bearer?: string,
  ) {
    void bearer;
    const url = this.meta.buildInstagramAuthUrl(projectPlatformId);
    return res.redirect(url);
  }

  @Public()
  @Get('instagram/oauth/callback')
  async instagramCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }
    try {
      const r = await this.meta.handleInstagramCallback(code, state);
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontend}/settings?instagram=ok&username=${encodeURIComponent(r.username)}`);
    } catch (e) {
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontend}/settings?instagram=error&msg=${encodeURIComponent((e as Error).message)}`);
    }
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR, Role.DIRECTOR, Role.SMM)
  @Post('instagram/:projectPlatformId/token')
  saveInstagramToken(
    @Param('projectPlatformId') projectPlatformId: string,
    @Body('accessToken') accessToken: string,
  ) {
    return this.meta.saveInstagramTokenManually(projectPlatformId, accessToken);
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR, Role.DIRECTOR, Role.SMM)
  @Delete('instagram/oauth/:projectPlatformId')
  disconnectInstagram(@Param('projectPlatformId') projectPlatformId: string) {
    return this.meta.disconnectInstagram(projectPlatformId);
  }

  @Get('instagram/:projectPlatformId/profile')
  getInstagramProfile(@Param('projectPlatformId') projectPlatformId: string) {
    return this.meta.getInstagramProfile(projectPlatformId);
  }

  @Get('instagram/:projectPlatformId/insights')
  getInstagramInsights(@Param('projectPlatformId') projectPlatformId: string) {
    return this.meta.getInstagramInsights(projectPlatformId);
  }
}
