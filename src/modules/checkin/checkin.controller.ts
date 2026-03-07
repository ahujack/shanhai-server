import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { CheckInService, CheckInResult, CheckInStatus } from './checkin.service';

@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  /**
   * 签到
   */
  @Post(':userId')
  async checkIn(@Param('userId') userId: string): Promise<CheckInResult> {
    return await this.checkInService.checkIn(userId);
  }

  /**
   * 获取签到状态
   */
  @Get('status/:userId')
  async getStatus(@Param('userId') userId: string): Promise<CheckInStatus> {
    return await this.checkInService.getCheckInStatus(userId);
  }

  /**
   * 获取签到日历
   */
  @Get('calendar/:userId')
  async getCalendar(@Param('userId') userId: string): Promise<string[]> {
    return await this.checkInService.getCheckInCalendar(userId);
  }
}
