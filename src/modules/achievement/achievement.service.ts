import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon?: string | null;
  category: string;
  requirement: number;
  points: number;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  achievement?: Achievement;
}

export interface UserAchievementWithDetails extends UserAchievement {
  achievement: Achievement;
}

@Injectable()
export class AchievementService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log('Achievement Service 已初始化');
    // 初始化成就数据
    await this.seedAchievements();
  }

  /**
   * 初始化成就数据
   */
  private async seedAchievements() {
    const achievements = [
      // 登录成就
      { code: 'login_1', name: '初次登录', description: '首次登录山海灵境', icon: '🌟', category: 'login', requirement: 1, points: 10 },
      { code: 'login_3', name: '连续登录', description: '连续登录3天', icon: '🔥', category: 'login', requirement: 3, points: 30 },
      { code: 'login_7', name: '一周之约', description: '连续登录7天', icon: '💫', category: 'login', requirement: 7, points: 70 },
      { code: 'login_30', name: '月度签到', description: '连续登录30天', icon: '🏆', category: 'login', requirement: 30, points: 300 },
      
      // 推荐成就
      { code: 'invite_1', name: '引路人', description: '成功邀请1位好友', icon: '🤝', category: 'invite', requirement: 1, points: 50 },
      { code: 'invite_5', name: '推广达人', description: '成功邀请5位好友', icon: '🌟', category: 'invite', requirement: 5, points: 200 },
      { code: 'invite_10', name: '金牌推手', description: '成功邀请10位好友', icon: '👑', category: 'invite', requirement: 10, points: 500 },
      
      // 抽签成就
      { code: 'draw_1', name: '初试手气', description: '完成首次抽签', icon: '🎯', category: 'draw', requirement: 1, points: 10 },
      { code: 'draw_10', name: '抽签达人', description: '累计抽签10次', icon: '🎰', category: 'draw', requirement: 10, points: 50 },
      { code: 'draw_50', name: '运气之王', description: '累计抽签50次', icon: '👑', category: 'draw', requirement: 50, points: 200 },
      
      // 命盘成就
      { code: 'chart_1', name: '初识命盘', description: '创建首个命盘', icon: '📊', category: 'chart', requirement: 1, points: 20 },
      { code: 'chart_3', name: '多面探索', description: '创建3个命盘', icon: '🔮', category: 'chart', requirement: 3, points: 60 },
      
      // 聊天成就
      { code: 'chat_1', name: '初次对话', description: '与灵伴首次对话', icon: '💬', category: 'chat', requirement: 1, points: 5 },
      { code: 'chat_50', name: '灵伴密友', description: '累计对话50次', icon: '🧙', category: 'chat', requirement: 50, points: 100 },
      { code: 'chat_200', name: '心灵导师', description: '累计对话200次', icon: '🌈', category: 'chat', requirement: 200, points: 300 },
      
      // 会员成就
      { code: 'vip_1', name: 'VIP体验', description: '首次开通VIP', icon: '💎', category: 'vip', requirement: 1, points: 50 },
      { code: 'premium_1', name: '高级会员', description: '升级为高级会员', icon: '⭐', category: 'vip', requirement: 1, points: 100 },
    ];

    for (const achievement of achievements) {
      await this.prisma.achievement.upsert({
        where: { code: achievement.code },
        update: {},
        create: achievement,
      });
    }
    
    console.log('成就数据初始化完成');
  }

  /**
   * 获取所有成就列表
   */
  async getAllAchievements(): Promise<Achievement[]> {
    return this.prisma.achievement.findMany({
      orderBy: { category: 'asc' },
    });
  }

  /**
   * 获取用户成就列表（包含解锁状态）
   */
  async getUserAchievements(userId: string): Promise<UserAchievementWithDetails[]> {
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
    
    return userAchievements;
  }

  /**
   * 获取用户成就解锁进度
   */
  async getUserProgress(userId: string): Promise<{
    total: number;
    unlocked: number;
    unlockedPoints: number;
  }> {
    const allAchievements = await this.prisma.achievement.count();
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    
    const unlocked = userAchievements.length;
    const unlockedPoints = userAchievements.reduce((sum, ua) => sum + ua.achievement.points, 0);
    
    return { total: allAchievements, unlocked, unlockedPoints };
  }

  /**
   * 检查并解锁成就
   */
  async checkAndUnlockAchievement(userId: string, category: string, count: number): Promise<Achievement | null> {
    // 查找该分类下达标的成就
    const achievement = await this.prisma.achievement.findFirst({
      where: {
        category,
        requirement: count,
      },
    });
    
    if (!achievement) {
      return null;
    }
    
    // 检查是否已解锁
    const existing = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
    });
    
    if (existing) {
      return null; // 已解锁
    }
    
    // 解锁成就
    await this.prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    });
    
    console.log(`用户 ${userId} 解锁成就: ${achievement.name}`);
    return achievement;
  }

  /**
   * 检查登录成就（签到时调用）
   */
  async checkLoginAchievements(userId: string, streak: number): Promise<Achievement | null> {
    return this.checkAndUnlockAchievement(userId, 'login', streak);
  }

  /**
   * 获取成就详情
   */
  async getAchievement(code: string): Promise<Achievement | null> {
    return this.prisma.achievement.findUnique({
      where: { code },
    });
  }
}
