import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  status() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'shan-hai-ling-jing-api',
    };
  }
}

