import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles } from '../auth/roles.decorator';

@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query('limit') limit?: string, @Query('userId') userId?: string) {
    return this.audit.list({
      limit: limit ? parseInt(limit, 10) : undefined,
      userId,
    });
  }
}
