import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('portal')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  portal(@Query('code') code?: string, @Query('token') token?: string) {
    return this.analytics.affiliatePortal(code, token);
  }
}
