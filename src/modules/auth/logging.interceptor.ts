import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, finalize, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const requestId = (headers['x-request-id'] as string) || randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    const startTime = Date.now();
    let errorMessage = '';

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorMessage = error instanceof Error ? error.message : String(error || '');
        },
      }),
      finalize(() => {
        const { statusCode } = response;
        const contentLength = response.getHeader('content-length') || '-';
        const duration = Date.now() - startTime;
        const suffix = errorMessage ? ` - error: ${errorMessage}` : '';
        this.logger.log(
          `[${requestId}] ${method} ${url} ${statusCode} ${contentLength} - ${duration}ms - ${ip} ${userAgent}${suffix}`,
        );
      }),
    );
  }
}
