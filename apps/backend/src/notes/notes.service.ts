import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  list(videoId: string) {
    return this.prisma.videoNote.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  create(input: { videoId: string; projectPlatformId: string; body: string }, authorId: string) {
    return this.prisma.videoNote.create({
      data: {
        videoId: input.videoId,
        projectPlatformId: input.projectPlatformId,
        body: input.body,
        authorId,
      },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async update(id: string, body: string, user: { id: string; role: Role }) {
    const note = await this.prisma.videoNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException();
    if (note.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Можно редактировать только свои заметки');
    }
    return this.prisma.videoNote.update({
      where: { id },
      data: { body },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async remove(id: string, user: { id: string; role: Role }) {
    const note = await this.prisma.videoNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException();
    if (note.authorId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Можно удалить только свои заметки');
    }
    await this.prisma.videoNote.delete({ where: { id } });
    return { ok: true };
  }
}
