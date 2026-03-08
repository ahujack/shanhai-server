import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AchievementService, Achievement, UserAchievementWithDetails } from './achievement.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  /**
   * 获取所有成就列表
   */
  @Get()
  async getAllAchievements(): Promise<Achievement[]> {
    return this.achievementService.getAllAchievements();
  }

  /**
   * 获取用户成就列表（需要登录）
   */
  @Get('user')
  @UseGuards(RequireAuthGuard)
  async getUserAchievements(@Request() req): Promise<UserAchievementWithDetails[]> {
    const userId = req.user.sub;
    return this.achievementService.getUserAchievements(userId);
  }

  /**
   * 获取用户成就进度（需要登录）
   */
  @Get('progress')
  @UseGuards(RequireAuthGuard)
  async getUserProgress(@Request() req) {
    const userId = req.user.sub;
    return this.achievementService.getUserProgress(userId);
  }

  /**
   * 检查并解锁成就（由其他服务调用）
   */
  @Post('check')
  @UseGuards(RequireAuthGuard)
  async checkAchievement(
    @Request() req,
    @Body() dto: { category: string; count: number }
  ) {
    const userId = req.user.sub;
    const achievement = await this.achievementService.checkAndUnlockAchievement(
      userId,
      dto.category,
      dto.count
    );
    
    if (achievement) {
      return {
        success: true,
        achievement,
        message: `解锁成就: ${achievement.name}`,
      };
    }
    
    return {
      success: false,
      message: '未解锁新成就',
    };
  }
}
