/**
 * 生产环境启动前校验。由 main.ts 在创建 Nest 应用前调用。
 */
export function assertProductionConfig(): void {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd) return;
  if (!process.env.JWT_SECRET?.trim()) {
    // eslint-disable-next-line no-console
    console.error('Bootstrap: 生产环境必须配置 JWT_SECRET，进程退出');
    process.exit(1);
  }
  const origins =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (origins.length === 0) {
    // eslint-disable-next-line no-console
    console.error('Bootstrap: 生产环境必须配置 ALLOWED_ORIGINS（逗号分隔的源列表），进程退出');
    process.exit(1);
  }
}

export function resolveCorsOrigin(): boolean | string[] {
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const allowedList =
    process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  if (isProd) return allowedList;
  return allowedList.length > 0 ? allowedList : true;
}
