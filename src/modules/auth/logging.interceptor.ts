import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const requestId = (headers['x-request-id'] as string) || randomUUID();
    request.requestId = requestId;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        response.setHeader('x-request-id', requestId);
        const { statusCode } = response;
        const contentLength = response.get('content-length') || '-';
        const duration = Date.now() - startTime;

        this.logger.log(
          `[${requestId}] ${method} ${url} ${statusCode} ${contentLength} - ${duration}ms - ${ip} ${userAgent}`
        );
      }),
    );
  }
}
