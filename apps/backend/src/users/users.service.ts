import { Injectable, ConflictException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: { email: string; password: string; name: string; role: Role }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return user;
  }

  async update(id: string, input: { name?: string; role?: Role; isActive?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();
    return this.prisma.user.update({
      where: { id },
      data: input,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  async updateMe(id: string, input: { name?: string; currentPassword?: string; newPassword?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    const data: { name?: string; passwordHash?: string } = {};
    if (input.name) data.name = input.name;

    if (input.newPassword) {
      if (!input.currentPassword) throw new BadRequestException('Укажите текущий пароль');
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new UnauthorizedException('Неверный текущий пароль');
      data.passwordHash = await bcrypt.hash(input.newPassword, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } }).catch(() => {
      throw new NotFoundException();
    });
    return { ok: true };
  }
}
