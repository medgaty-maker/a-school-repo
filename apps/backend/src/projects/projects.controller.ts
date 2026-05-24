import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProjectPriority, Role } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { Roles } from '../auth/roles.decorator';

class UpdateProjectDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ProjectPriority) priority?: ProjectPriority;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.projects.getBySlug(slug);
  }

  @Get(':slug/metrics')
  metrics(
    @Param('slug') slug: string,
    @Query('days') days?: string,
    @Query('period') period?: string,
  ) {
    const daysBack = period
      ? ProjectsService.periodToDays(period)
      : days
        ? parseInt(days, 10)
        : 30;
    return this.projects.getMetrics(slug, daysBack);
  }

  @Roles(Role.ADMIN, Role.MARKETING_DIRECTOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }
}
