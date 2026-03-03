import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ChartService } from './chart.service';
import { UserService } from '../user/user.service';

@Controller('charts')
export class ChartController {
  constructor(
    private readonly chartService: ChartService,
    private readonly userService: UserService,
  ) {}

  @Post(':userId')
  async generate(
    @Param('userId') userId: string,
    @Body() body: { gender: 'male' | 'female' }
  ) {
    const user = this.userService.findOne(userId);
    return await this.chartService.generateChart(
      userId,
      user.birthDate,
      user.birthTime,
      body.gender
    );
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    const chart = this.chartService.findOne(userId);
    if (!chart) {
      return { message: '请先创建命盘', hasChart: false };
    }
    return { hasChart: true, chart };
  }
}
