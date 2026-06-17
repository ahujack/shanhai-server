import { Controller, Get, Post, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChartService } from './chart.service';
import { UserService } from '../user/user.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeAppLanguage } from '../../common/app-language';

@Controller('charts')
export class ChartController {
  constructor(
    private readonly chartService: ChartService,
    private readonly userService: UserService,
  ) {}

  private readLanguageHeader(headers?: Record<string, string | string[] | undefined>): string | undefined {
    const raw = headers?.['x-app-language'];
    return Array.isArray(raw) ? raw[0] : raw;
  }

  private resolveMembershipTier(user: {
    membership?: 'free' | 'premium' | 'vip' | string | null;
    membershipExpiryAt?: Date | null;
  }): 'free' | 'premium' | 'vip' {
    const tier = (user.membership as 'free' | 'premium' | 'vip') || 'free';
    if ((tier === 'premium' || tier === 'vip') && (!user.membershipExpiryAt || user.membershipExpiryAt > new Date())) {
      return tier;
    }
    return 'free';
  }

  /** 游客试算：不落库，无需登录 */
  @Post('preview')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async preview(
    @Body()
    body: {
      birthDate: string;
      birthTime: string;
      gender: 'male' | 'female';
      calendarType?: 'solar' | 'lunar';
      isLeapMonth?: boolean;
      birthLongitude?: number;
      birthLocation?: string;
      timezone?: string;
      language?: string;
    },
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
  ) {
    const birthDate = String(body.birthDate || '').trim();
    const birthTime = String(body.birthTime || '').trim();
    if (!birthDate || !birthTime) {
      throw new BadRequestException('请填写出生日期与出生时间');
    }
    const gender = body.gender === 'female' ? 'female' : 'male';
    const language = normalizeAppLanguage(body.language || this.readLanguageHeader(req.headers));
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return this.chartService.generateChart(guestId, birthDate, birthTime, gender, {
      calendarType: body.calendarType || 'solar',
      isLeapMonth: !!body.isLeapMonth,
      birthLongitude: body.birthLongitude,
      birthLocation: body.birthLocation,
      timezone: body.timezone,
      membership: 'free',
      persist: false,
      language,
    });
  }

  @Post(':userId')
  @UseGuards(RequireAuthGuard)
  async generate(
    @Param('userId') userId: string,
    @Body() body: { gender: 'male' | 'female'; language?: string },
    @Req() req: { user: { sub?: string; id?: string }; headers?: Record<string, string | string[] | undefined> },
  ) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    // 以 token 中的用户为准，避免 path 与 token 不一致
    const targetUserId = authUserId;
    const language = normalizeAppLanguage(body.language || this.readLanguageHeader(req.headers));
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
        membership: this.resolveMembershipTier(user),
        language,
      },
    );
  }

  @Get(':userId')
  @UseGuards(RequireAuthGuard)
  async findOne(
    @Param('userId') userId: string,
    @Req() req: { user: { sub?: string; id?: string }; headers?: Record<string, string | string[] | undefined> },
  ) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    // 以 token 中的用户为准
    const targetUserId = authUserId;
    const language = normalizeAppLanguage(this.readLanguageHeader(req.headers));
    const user = await this.userService.findOne(targetUserId);
    const chart = await this.chartService.findOne(
      targetUserId,
      this.resolveMembershipTier(user),
      language,
    );
    if (!chart) {
      return { message: '请先创建命盘', hasChart: false };
    }
    return { hasChart: true, chart };
  }
}
