import { Controller, Get, Post, Query } from '@nestjs/common';
import { FortuneService } from './fortune.service';

@Controller('fortunes')
export class FortuneController {
  constructor(private readonly fortuneService: FortuneService) {}

  @Get('daily')
  getDailyFortune(@Query('userId') userId?: string) {
    return this.fortuneService.getDailyFortune(userId);
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
