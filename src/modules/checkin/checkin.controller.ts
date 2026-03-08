import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CheckInService, CheckInResult, CheckInStatus } from './checkin.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  /**
   * 签到（需要登录）
   */
  @Post()
  @UseGuards(RequireAuthGuard)
  async checkIn(@Request() req): Promise<CheckInResult> {
    const userId = req.user.sub;
    return await this.checkInService.checkIn(userId);
  }

  /**
   * 获取签到状态（需要登录）
   */
  @Get('status')
  @UseGuards(RequireAuthGuard)
  async getStatus(@Request() req): Promise<CheckInStatus> {
    const userId = req.user.sub;
    return await this.checkInService.getCheckInStatus(userId);
  }

  /**
   * 获取签到日历（需要登录）
   */
  @Get('calendar')
  @UseGuards(RequireAuthGuard)
  async getCalendar(@Request() req): Promise<string[]> {
    const userId = req.user.sub;
    return await this.checkInService.getCheckInCalendar(userId);
  }
}
