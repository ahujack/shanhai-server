import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CheckInService, CheckInResult, CheckInStatus } from './checkin.service';
import { JwtAuthGuard, RequireAuthGuard } from '../auth/jwt-auth.guard';

const guestCheckInStatus: CheckInStatus = {
  todayCheckedIn: false,
  currentStreak: 0,
  totalPoints: 0,
  consecutiveDays: 0,
};

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
   * 获取签到状态（未登录或 token 无效时返回空状态，避免首页 401）
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req): Promise<CheckInStatus> {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      return guestCheckInStatus;
    }
    return await this.checkInService.getCheckInStatus(userId);
  }

  /**
   * 获取签到日历（未登录返回空数组）
   */
  @Get('calendar')
  @UseGuards(JwtAuthGuard)
  async getCalendar(@Request() req): Promise<string[]> {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      return [];
    }
    return await this.checkInService.getCheckInCalendar(userId);
  }
}
