import { Logger } from '@nestjs/common';

const logger = new Logger('ProductionEnv');

/**
 * 生产环境启动前提示（不阻断启动，避免存量 Railway 等未配全变量时部署失败）。
 * 仍强烈建议在平台配置 JWT_SECRET 与 ALLOWED_ORIGINS，见 DEPLOY_CHECKLIST.md。
 */
export function assertProductionConfig(): void {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd) return;
  if (!process.env.JWT_SECRET?.trim()) {
    logger.error(
      '生产环境未设置 JWT_SECRET：存在 token 可伪造风险，请尽快在宿主平台配置强随机密钥。',
    );
  }
  const origins =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (origins.length === 0) {
    logger.warn(
      '生产环境未设置 ALLOWED_ORIGINS：CORS 将回退为允许任意来源，请尽快改为逗号分隔白名单。',
    );
  }
}

/** 配置了白名单则用白名单，否则 true（与历史行为一致，便于部署） */
export function resolveCorsOrigin(): boolean | string[] {
  const allowedList =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (allowedList.length > 0) return allowedList;
  return true;
}
