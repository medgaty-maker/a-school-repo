import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();

    if (!MUTATING_METHODS.has(req.method)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        this.audit
          .log({
            userId: req.user?.id,
            action: `${req.method} ${req.route?.path ?? req.path}`,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          })
          .catch(() => undefined);
      }),
    );
  }
}
