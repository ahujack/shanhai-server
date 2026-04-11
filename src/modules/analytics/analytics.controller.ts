import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { SubmitFeedbackDto, TrackEventsDto } from './dto/analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** 客户端批量埋点；Bearer 可选，有则关联 userId */
  @Post('track')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 90, ttl: 60000 } })
  async track(@Body() dto: TrackEventsDto, @Req() req: Request) {
    const u = (req as Request & { user?: { sub?: string; id?: string } }).user;
    const userId = u?.sub ?? u?.id;
    return this.analytics.ingestFromClient(userId ? String(userId) : null, dto, req);
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async feedback(@Body() dto: SubmitFeedbackDto, @Req() req: Request) {
    const u = (req as Request & { user?: { sub?: string; id?: string } }).user;
    const userId = u?.sub ?? u?.id;
    return this.analytics.submitFeedback(userId ? String(userId) : null, dto);
  }
}
