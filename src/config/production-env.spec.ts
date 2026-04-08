import { assertProductionConfig, getJwtSecret, resolveCorsOrigin } from './production-env';

describe('production-env', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it('resolveCorsOrigin without ALLOWED_ORIGINS returns true', () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.NODE_ENV;
    expect(resolveCorsOrigin()).toBe(true);
  });

  it('resolveCorsOrigin with ALLOWED_ORIGINS returns list', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:8080';
    expect(resolveCorsOrigin()).toEqual(['http://localhost:3000', 'http://127.0.0.1:8080']);
  });

  it('resolveCorsOrigin production without ALLOWED_ORIGINS throws', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    expect(() => resolveCorsOrigin()).toThrow('ALLOWED_ORIGINS');
  });

  it('assertProductionConfig throws when JWT_SECRET missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    process.env.ALLOWED_ORIGINS = 'https://shanhai.app';
    expect(() => assertProductionConfig()).toThrow('JWT_SECRET');
  });

  it('getJwtSecret uses fallback outside production', () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    expect(getJwtSecret()).toBe('shanhai-secret-key-change-in-production');
  });
});
