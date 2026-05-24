import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ip?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        ip: entry.ip,
        userAgent: entry.userAgent,
        details: entry.details as Prisma.InputJsonValue | undefined,
      },
    });
  }

  list(opts: { limit?: number; userId?: string }) {
    return this.prisma.auditLog.findMany({
      where: opts.userId ? { userId: opts.userId } : undefined,
      take: opts.limit ?? 100,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    });
  }
}
