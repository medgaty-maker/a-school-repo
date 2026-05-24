import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { NotesService } from './notes.service';
import { CurrentUser, CurrentUserType } from '../auth/current-user.decorator';

class CreateNoteDto {
  @IsString() videoId!: string;
  @IsString() projectPlatformId!: string;
  @IsString() @MinLength(1) body!: string;
}

class UpdateNoteDto {
  @IsString() @MinLength(1) body!: string;
}

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query('videoId') videoId: string) {
    return this.notes.list(videoId);
  }

  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: CurrentUserType) {
    return this.notes.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notes.update(id, dto.body, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.notes.remove(id, user);
  }
}
