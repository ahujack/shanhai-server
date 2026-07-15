import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('launch-metrics')
  launchMetrics(@Query('days') daysRaw?: string) {
    const days = Number.parseInt(String(daysRaw || '7'), 10);
    return this.analytics.adminLaunchMetrics(Number.isFinite(days) ? days : 7);
  }

  @Get('affiliate-partners')
  affiliatePartners() {
    return this.analytics.adminAffiliatePartners();
  }

  @Post('affiliate-partners')
  createAffiliatePartner(
    @Body()
    body: {
      code?: string;
      name?: string;
      email?: string;
      commissionRate?: number;
      attributionDays?: number;
      recurringDays?: number;
      parentPartnerId?: string;
      overrideCommissionRate?: number;
      settlementCycle?: 'weekly' | 'monthly';
      minimumPayout?: number;
      note?: string;
    },
  ) {
    return this.analytics.adminCreateAffiliatePartner(body);
  }

  @Post('affiliate-partners/:id/dashboard-token')
  resetAffiliateDashboardToken(@Param('id') id: string) {
    return this.analytics.adminResetAffiliateDashboardToken(id);
  }

  @Get('affiliate-report')
  affiliateReport(
    @Query('partnerId') partnerId?: string,
    @Query('days') daysRaw?: string,
  ) {
    const days = Number.parseInt(String(daysRaw || '30'), 10);
    return this.analytics.adminAffiliateReport(
      partnerId,
      Number.isFinite(days) ? days : 30,
    );
  }
}
