import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FortuneService, FortuneSlip } from './fortune.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('fortunes')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  /** 未登录或 token 过期时按游客返回当日签（与 getDailyFortune 内 guest 种子一致） */
  @Get('daily')
  @UseGuards(JwtAuthGuard)
  getDailyFortune(@Req() req: { user?: { sub?: string; id?: string } }) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.fortuneService.getDailyFortune(userId);
  }

  @Get('draw')
  drawRandom() {
    return this.fortuneService.drawRandomSlip();
  }

  /** 签文 → 竖屏条漫分镜（可游客） */
  @Post('comic')
  composeComic(
    @Body()
    body: {
      slip?: Partial<FortuneSlip>;
      companionId?: 'elder' | 'youth' | 'oracle';
    },
  ) {
    return this.fortuneService.composeComic(body?.slip, body?.companionId);
  }

  @Get(':index')
  getByIndex(@Query('index') index: number) {
    return this.fortuneService.getSlipByIndex(index);
  }
}
