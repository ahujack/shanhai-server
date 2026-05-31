import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@UseGuards(RequireAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Query('days') daysRaw?: string) {
    const days = Number.parseInt(String(daysRaw || '30'), 10);
    return this.analytics.adminOverview(Number.isFinite(days) ? days : 30);
  }

  @Get('logins')
  logins(@Query('limit') limitRaw?: string) {
    const limit = Number.parseInt(String(limitRaw || '80'), 10);
    return this.analytics.adminRecentLogins(
      Number.isFinite(limit) ? limit : 80,
    );
  }

  @Get('feedback')
  feedbackList(
    @Query('page') pageRaw?: string,
    @Query('pageSize') sizeRaw?: string,
  ) {
    const page = Number.parseInt(String(pageRaw || '1'), 10);
    const pageSize = Number.parseInt(String(sizeRaw || '20'), 10);
    return this.analytics.adminFeedbackList(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 20,
    );
  }

  @Get('funnel')
  funnel(@Query('days') daysRaw?: string) {
    const days = Number.parseInt(String(daysRaw || '14'), 10);
    return this.analytics.adminFunnel(Number.isFinite(days) ? days : 14);
  }

  @Get('ops-health')
  opsHealth(@Query('days') daysRaw?: string) {
    const days = Number.parseInt(String(daysRaw || '7'), 10);
    return this.analytics.adminOpsHealth(Number.isFinite(days) ? days : 7);
  }
}
