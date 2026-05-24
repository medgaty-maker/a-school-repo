import { Controller, Delete, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Role, IntegrationStatus, Platform } from '@prisma/client';
import { YoutubeService } from './youtube.service';
import { Roles } from '../../auth/roles.decorator';
import { Public } from '../../auth/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('integrations/youtube')
export class YoutubeController {
  constructor(
    private readonly youtube: YoutubeService,
    private readonly prisma: PrismaService,
  ) {}

  // §6.7 — топ контент: последние видео всех активных YT-каналов
  @Get('top-videos')
  async topVideos(@Query('limit') limit?: string, @Query('sort') sort?: string) {
    const max = limit ? parseInt(limit, 10) : 10;
    const platforms = await this.prisma.projectPlatform.findMany({
      where: { platform: Platform.YOUTUBE, status: IntegrationStatus.ACTIVE },
      include: { project: { select: { slug: true, name: true } } },
    });

    const all: Array<any> = [];
    for (const pp of platforms) {
      try {
        const videos = await this.youtube.getRecentVideos(pp.id, 50);
        for (const v of videos) {
          all.push({
            ...v,
            projectSlug: pp.project.slug,
            projectName: pp.project.name,
            channelTitle: pp.externalAccountName,
          });
        }
      } catch (e) {
        // skip — отдельный канал может временно фейлить
      }
    }

    if (sort === 'asc') {
      all.sort((a, b) => a.views - b.views);
    } else {
      all.sort((a, b) => b.views - a.views);
    }
    return all.slice(0, max);
  }

  // §6.6 — агрегированная активность всех YouTube каналов по дням
  @Get('aggregate-daily')
  async aggregateDaily() {
    const platforms = await this.prisma.projectPlatform.findMany({
      where: { platform: Platform.YOUTUBE, status: IntegrationStatus.ACTIVE },
    });

    const byDay = new Map<string, number>();
    for (const pp of platforms) {
      try {
        const detail = await this.youtube.getDetail(pp.id);
        for (const d of detail.daily_views) {
          byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.views);
        }
      } catch {
        // skip
      }
    }

    return Array.from(byDay.entries())
      .map(([day, views]) => ({ day, views }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Get('oauth/start/:projectPlatformId')
  start(@Param('projectPlatformId') projectPlatformId: string, @Res() res: Response) {
    const url = this.youtube.buildAuthUrl(projectPlatformId);
    return res.redirect(url);
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Delete('oauth/:projectPlatformId')
  disconnect(@Param('projectPlatformId') projectPlatformId: string) {
    return this.youtube.disconnect(projectPlatformId);
  }

  // OAuth callback — public, валидация через state (projectPlatformId)
  @Public()
  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }
    try {
      const r = await this.youtube.handleCallback(code, state);
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3000';
      res.redirect(`${frontend}/settings?youtube=ok&channel=${encodeURIComponent(r.channelTitle)}`);
    } catch (e) {
      res.status(400).send(`OAuth callback failed: ${(e as Error).message}`);
    }
  }

  @Get(':projectPlatformId/channel')
  channel(@Param('projectPlatformId') id: string) {
    return this.youtube.getChannelInfo(id);
  }

  @Get(':projectPlatformId/videos')
  videos(@Param('projectPlatformId') id: string, @Query('limit') limit?: string) {
    return this.youtube.getRecentVideos(id, limit ? parseInt(limit, 10) : 10);
  }

  @Get(':projectPlatformId/detail')
  detail(@Param('projectPlatformId') id: string) {
    return this.youtube.getDetail(id);
  }
}
