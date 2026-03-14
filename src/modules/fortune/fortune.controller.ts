import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FortuneService } from './fortune.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('fortunes')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  @Get('daily')
  @UseGuards(RequireAuthGuard)
  getDailyFortune(@Req() req: { user: { sub: string } }) {
    return this.fortuneService.getDailyFortune(req.user.sub);
  }

  @Get('draw')
  drawRandom() {
    return this.fortuneService.drawRandomSlip();
  }

  @Get(':index')
  getByIndex(@Query('index') index: number) {
    return this.fortuneService.getSlipByIndex(index);
  }
}
