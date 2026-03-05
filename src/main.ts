import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { config } from 'dotenv';
import * as path from 'path';

// 加载 .env 文件作为基础配置
config({ path: path.resolve(__dirname, '../.env') });
// 加载 .env.local 文件覆盖基础配置（如果有的话）
config({ path: path.resolve(__dirname, '../.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // 允许额外属性
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
