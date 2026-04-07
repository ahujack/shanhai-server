import { resolveCorsOrigin } from './production-env';

describe('production-env', () => {
  const orig = { ...process.env };

  afterEach(() => {
    process.env = { ...orig };
  });

  it('resolveCorsOrigin dev without ALLOWED_ORIGINS returns true', () => {
    delete process.env.NODE_ENV;
    delete process.env.ALLOWED_ORIGINS;
    expect(resolveCorsOrigin()).toBe(true);
  });

  it('resolveCorsOrigin dev with ALLOWED_ORIGINS returns list', () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:8080';
    expect(resolveCorsOrigin()).toEqual(['http://localhost:3000', 'http://127.0.0.1:8080']);
  });
});
