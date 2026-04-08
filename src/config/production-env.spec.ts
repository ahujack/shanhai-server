import { resolveCorsOrigin } from './production-env';

describe('production-env', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it('resolveCorsOrigin without ALLOWED_ORIGINS returns true', () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(resolveCorsOrigin()).toBe(true);
  });

  it('resolveCorsOrigin with ALLOWED_ORIGINS returns list', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:8080';
    expect(resolveCorsOrigin()).toEqual(['http://localhost:3000', 'http://127.0.0.1:8080']);
  });

  it('resolveCorsOrigin production without ALLOWED_ORIGINS still returns true (deploy fallback)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    expect(resolveCorsOrigin()).toBe(true);
  });
});
