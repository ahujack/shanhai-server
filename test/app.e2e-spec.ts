import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * 仅当设置 E2E_DATABASE_URL 时跑集成测试（避免 .env 里无效的 DATABASE_URL 导致误跑失败）。
 * 例：E2E_DATABASE_URL="postgresql://..." npm run test:e2e
 */
const describeE2e = process.env.E2E_DATABASE_URL ? describe : describe.skip;

if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

describeE2e('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns success', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(['ok', 'degraded']).toContain(res.body.status);
      });
  });

  it('GET /api/users without auth returns 401', () => {
    return request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('GET /api/users/me without auth returns 401', () => {
    return request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('GET /api/users/:id without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });

  it('DELETE /api/users/:id without auth returns 401', () => {
    return request(app.getHttpServer())
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .expect(401);
  });
});
