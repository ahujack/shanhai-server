import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { PointsService, PointsSummary, PointRecord } from './points.service';
import { JwtAuthGuard, RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  /**
   * 获取用户积分概况（需要登录）
   */
  @Get()
  @UseGuards(RequireAuthGuard)
  async getUserPoints(@Request() req): Promise<PointsSummary> {
    const userId = req.user.sub;
    return this.pointsService.getUserPointsSummary(userId);
  }

  /**
   * 获取积分记录（需要登录）
   */
  @Get('records')
  @UseGuards(RequireAuthGuard)
  async getPointRecords(
    @Request() req,
    @Query('limit') limit?: string
  ): Promise<PointRecord[]> {
    const userId = req.user.sub;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.pointsService.getPointRecords(userId, parsedLimit);
  }

  /**
   * 消费积分（需要登录）
   */
  @Post('consume')
  @UseGuards(RequireAuthGuard)
  async consumePoints(
    @Request() req,
    @Body() dto: { points: number; type: string; description: string }
  ) {
    const userId = req.user.sub;
    
    if (dto.points <= 0) {
      return { success: false, message: '积分数量必须大于0' };
    }
    
    return this.pointsService.consumePoints(
      userId,
      dto.points,
      dto.type,
      dto.description
    );
  }

  /**
   * 检查积分是否足够（可选登录：未登录或 token 无效时返回 hasEnough: false，避免 401 误清前端会话）
   */
  @Post('check')
  @UseGuards(JwtAuthGuard)
  async checkPoints(
    @Request() req,
    @Body() dto: { points: number }
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      return { success: true, hasEnough: false };
    }
    const need = Number(dto?.points);
    if (!Number.isFinite(need) || need <= 0) {
      return { success: true, hasEnough: true };
    }
    const hasEnough = await this.pointsService.hasEnoughPoints(userId, need);
    return { success: true, hasEnough };
  }
}
