import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request?.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let error = 'Internal Server Error';
    const ex = exception as any;

    if (ex?.name === 'MulterError') {
      status = HttpStatus.BAD_REQUEST;
      const code = String(ex?.code || '');
      if (code === 'LIMIT_FILE_SIZE') {
        message = '音频文件过大，请缩短录音后重试';
      } else {
        message = `音频上传失败：${ex?.message || '文件格式或大小不符合要求'}`;
      }
      error = 'Bad Request';
    } else

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        const rawMessage = resp.message;
        if (Array.isArray(rawMessage)) {
          message = rawMessage.map((item) => String(item)).join('；');
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else {
          message = exception.message;
        }
        error = (resp.error as string) || 'Error';
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      // 记录未预期的错误（生产环境也要记录详细日志）
      this.logger.error(`未预期的错误: ${exception.message}`, exception.stack);
      message = '服务暂时不可用，请稍后重试';
    }

    const errorResponse: Record<string, unknown> = {
      success: false,
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    };

    // 生产环境不返回详细错误信息
    if (process.env.NODE_ENV === 'production') {
      delete errorResponse.error;
    }

    this.logger.warn(`[${requestId || 'no-request-id'}] ${status} ${message}`);
    if (requestId) {
      response.setHeader('x-request-id', requestId);
    }
    response.status(status).json(errorResponse);
  }
}
