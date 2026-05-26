import { Controller, Delete, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TikTokService } from './tiktok.service';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Controller('integrations/tiktok')
export class TikTokController {
  constructor(private readonly svc: TikTokService) {}

  @UseGuards(JwtAuthGuard)
  @Get('config')
  async getConfig() {
    const cfg = await this.svc.getConfig();
    return { ...(cfg ?? {}), authUrl: this.svc.getAuthUrl() };
  }

  @UseGuards(JwtAuthGuard)
  @Get('oauth/init')
  initOAuth(@Res() res: Response) {
    res.redirect(this.svc.getAuthUrl());
  }

  @Get('oauth/callback')
  async callback(@Query('code') code: string, @Query('error') error: string, @Res() res: Response) {
    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/settings?tiktok=error`);
    }
    const result = await this.svc.handleCallback(code);
    if (result.success) {
      return res.redirect(`${FRONTEND_URL}/settings?tiktok=connected`);
    }
    return res.redirect(`${FRONTEND_URL}/settings?tiktok=error`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('videos')
  getVideos() {
    return this.svc.getVideos();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect() {
    return this.svc.disconnect();
  }
}
