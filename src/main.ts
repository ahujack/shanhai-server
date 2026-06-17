import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config } from 'dotenv';
import * as path from 'path';
import { GlobalExceptionFilter } from './modules/auth/global-exception.filter';
import { LoggingInterceptor } from './modules/auth/logging.interceptor';
import { assertProductionConfig, resolveCorsOrigin } from './config/production-env';
import { resolveDeepSeekChatUrl, resolveMultimodalChatUrl } from './common/llm-endpoint';

// 加载 .env 文件作为基础配置
config({ path: path.resolve(__dirname, '../.env') });
// 加载 .env.local 文件覆盖基础配置（如果有的话）
config({ path: path.resolve(__dirname, '../.env.local'), override: true });

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  assertProductionConfig();

  const corsOrigin = resolveCorsOrigin();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'debug', 'error', 'verbose', 'warn'],
    // Creem Webhook 签名校验需要与发送方一致的原始 JSON 字节
    rawBody: true,
  });

  // 启用 CORS（生产环境必须显式配置 ALLOWED_ORIGINS）
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-App-Language',
      'creem-signature',
    ],
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

  // 内置管理看板（静态页）：部署后与 API 同源，打开 /admin/index.html
  app.useStaticAssets(path.join(__dirname, '..', 'public'), { index: false });

  const port = process.env.PORT ?? 3000;
  
  await app.listen(port);
  
  logger.log(`🚀 山海灵境 API 服务已启动: http://localhost:${port}`);
  logger.log(`📦 环境: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🤖 文本 LLM: ${resolveDeepSeekChatUrl()}`);
  logger.log(`🖼️ 多模态 LLM: ${resolveMultimodalChatUrl()}`);
  
  // 健康检查
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`🔍 健康检查: http://localhost:${port}/api/health`);
  }
}
bootstrap();
