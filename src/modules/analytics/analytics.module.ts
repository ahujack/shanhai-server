import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AnalyticsController } from './analytics.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AffiliateController } from './affiliate.controller';
import { AnalyticsService } from './analytics.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AnalyticsController, AdminAnalyticsController, AffiliateController],
  providers: [AnalyticsService, AdminGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
