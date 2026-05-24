import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { UtmService, ALLOWED_MEDIUMS, ALLOWED_SOURCES, CreateUtmInput } from './utm.service';
import { CurrentUser, CurrentUserType } from '../auth/current-user.decorator';

class CreateUtmDto implements CreateUtmInput {
  @IsString() @MinLength(3) label!: string;
  @IsString() baseUrl!: string;
  @IsString() source!: string;
  @IsString() medium!: string;
  @IsString() campaign!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsString() projectId?: string;
}

@Controller('utm')
export class UtmController {
  constructor(private readonly utm: UtmService) {}

  @Get('rules')
  rules() {
    return {
      sources: ALLOWED_SOURCES,
      mediums: ALLOWED_MEDIUMS,
      tokenPattern: '^[a-z0-9_-]+$',
      tokenHint: 'строчные латинские буквы, цифры, дефис, подчёркивание',
    };
  }

  @Get()
  list(@Query('limit') limit?: string, @Query('projectId') projectId?: string) {
    return this.utm.list({
      limit: limit ? parseInt(limit, 10) : undefined,
      projectId,
    });
  }

  @Post('preview')
  preview(@Body() dto: CreateUtmDto) {
    return this.utm.preview(dto);
  }

  @Post()
  create(@Body() dto: CreateUtmDto, @CurrentUser() user: CurrentUserType) {
    return this.utm.create(dto, user?.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.utm.remove(id);
  }
}
