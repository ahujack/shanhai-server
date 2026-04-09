import { Logger } from '@nestjs/common';

const logger = new Logger('ProductionEnv');
const FALLBACK_JWT_SECRET = 'shanhai-secret-key-change-in-production';
const isProdEnv = () => (process.env.NODE_ENV || '').toLowerCase() === 'production';

/**
 * 生产环境启动前强校验。
 * - 必须配置 JWT_SECRET
 * - 必须配置 ALLOWED_ORIGINS
 */
export function assertProductionConfig(): void {
  if (!isProdEnv()) return;
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('生产环境缺少 JWT_SECRET，已阻断启动。请配置强随机密钥后重启。');
  }
  const origins =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (origins.length === 0) {
    throw new Error('生产环境缺少 ALLOWED_ORIGINS，已阻断启动。请配置 CORS 白名单后重启。');
  }
  const hasCreemApiKey = !!process.env.CREEM_API_KEY?.trim();
  if (hasCreemApiKey && !process.env.CREEM_WEBHOOK_SECRET?.trim()) {
    throw new Error('生产环境已启用 Creem，但缺少 CREEM_WEBHOOK_SECRET，已阻断启动。');
  }
}

/** 配置了白名单则用白名单；非生产允许 true，生产缺失时抛错 */
export function resolveCorsOrigin(): boolean | string[] {
  const allowedList =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (allowedList.length > 0) return allowedList;
  if (isProdEnv()) {
    throw new Error('生产环境必须配置 ALLOWED_ORIGINS');
  }
  return true;
}

/** 获取 JWT 密钥：生产环境必须显式配置，开发环境允许 fallback */
export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (isProdEnv()) {
    throw new Error('生产环境必须配置 JWT_SECRET');
  }
  logger.warn('未设置 JWT_SECRET，当前使用开发环境默认密钥（仅限本地/测试）。');
  return FALLBACK_JWT_SECRET;
}
