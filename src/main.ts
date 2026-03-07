import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { config } from 'dotenv';
import * as path from 'path';
import { GlobalExceptionFilter } from './modules/auth/global-exception.filter';
import { LoggingInterceptor } from './modules/auth/logging.interceptor';

// 加载 .env 文件作为基础配置
config({ path: path.resolve(__dirname, '../.env') });
// 加载 .env.local 文件覆盖基础配置（如果有的话）
config({ path: path.resolve(__dirname, '../.env.local'), override: true });

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'debug', 'error', 'verbose', 'warn'],
  });

  // 启用 CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 设置全局前缀
  app.setGlobalPrefix('api');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离未定义的属性
      transform: true, // 自动转换数据类型
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 全局日志拦截器
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT ?? 3000;
  
  await app.listen(port);
  
  logger.log(`🚀 山海灵境 API 服务已启动: http://localhost:${port}`);
  logger.log(`📦 环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 健康检查
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`🔍 健康检查: http://localhost:${port}/api/health`);
  }
}
bootstrap();
