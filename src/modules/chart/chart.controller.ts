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
    @Req() req: { user: { sub: string } },
  ) {
    if (userId !== req.user.sub) {
      throw new BadRequestException('无权操作他人命盘');
    }
    const user = await this.userService.findOne(userId);
    return await this.chartService.generateChart(
      userId,
      user.birthDate || '1990-01-01',
      user.birthTime || '00:00',
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
    @Req() req: { user: { sub: string } },
  ) {
    if (userId !== req.user.sub) {
      throw new BadRequestException('无权查看他人命盘');
    }
    const user = await this.userService.findOne(userId);
    const chart = await this.chartService.findOne(
      userId,
      (user.membership as 'free' | 'premium' | 'vip') || 'free',
    );
    if (!chart) {
      return { message: '请先创建命盘', hasChart: false };
    }
    return { hasChart: true, chart };
  }
}
