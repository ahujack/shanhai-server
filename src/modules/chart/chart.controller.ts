import { Controller, Get, Post, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ChartService } from './chart.service';
import { UserService } from '../user/user.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('charts')
export class ChartController {
  constructor(
    private readonly chartService: ChartService,
    private readonly userService: UserService,
  ) {}

  @Post(':userId')
  @UseGuards(RequireAuthGuard)
  async generate(
    @Param('userId') userId: string,
    @Body() body: { gender: 'male' | 'female' },
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    // 以 token 中的用户为准，避免 path 与 token 不一致
    const targetUserId = authUserId;
    const user = await this.userService.findOne(targetUserId);
    if (!user.birthDate || !user.birthTime) {
      throw new BadRequestException('请先在个人资料中完善出生日期和时间');
    }
    return await this.chartService.generateChart(
      targetUserId,
      user.birthDate,
      user.birthTime,
      body.gender,
      {
        calendarType: user.calendarType || 'solar',
        isLeapMonth: user.isLeapMonth || false,
        birthLongitude: user.birthLongitude,
        birthLocation: user.birthLocation,
        timezone: user.timezone,
        membership: (user.membership as 'free' | 'premium' | 'vip') || 'free',
      },
    );
  }

  @Get(':userId')
  @UseGuards(RequireAuthGuard)
  async findOne(
    @Param('userId') userId: string,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    // 以 token 中的用户为准
    const targetUserId = authUserId;
    const user = await this.userService.findOne(targetUserId);
    const chart = await this.chartService.findOne(
      targetUserId,
      (user.membership as 'free' | 'premium' | 'vip') || 'free',
    );
    if (!chart) {
      return { message: '请先创建命盘', hasChart: false };
    }
    return { hasChart: true, chart };
  }
}
