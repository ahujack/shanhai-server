import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        error = (resp.error as string) || 'Error';
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      // 记录未预期的错误
      this.logger.error(`未预期的错误: ${exception.message}`, exception.stack);
      message = process.env.NODE_ENV === 'production' 
        ? '服务暂时不可用，请稍后重试' 
        : exception.message;
    }

    const errorResponse: Record<string, unknown> = {
      success: false,
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    };

    // 生产环境不返回详细错误信息
    if (process.env.NODE_ENV === 'production') {
      delete errorResponse.error;
    }

    response.status(status).json(errorResponse);
  }
}
