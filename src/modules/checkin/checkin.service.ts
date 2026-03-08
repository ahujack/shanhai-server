import { Injectable, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AchievementService } from '../achievement/achievement.service';

export interface CheckInResult {
  success: boolean;
  message: string;
  streak: number;
  points: number;
  reward?: string;
  isFirstCheckIn?: boolean;
  unlockedAchievement?: {
    name: string;
    description: string;
    icon: string;
  } | null;
}

export interface CheckInStatus {
  todayCheckedIn: boolean;
  currentStreak: number;
  totalPoints: number;
  consecutiveDays: number;
}

@Injectable()
export class CheckInService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AchievementService))
    private achievementService?: AchievementService,
  ) {}

  async onModuleInit() {
    console.log('📝 CheckIn Service 已初始化');
  }

  /**
   * 用户签到
   */
  async checkIn(userId: string): Promise<CheckInResult> {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今天是否已经签到
    const existingCheckIn = await this.prisma.checkIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (existingCheckIn) {
      return {
        success: false,
        message: '今日已签到',
        streak: existingCheckIn.streak,
        points: existingCheckIn.points,
      };
    }

    // 获取昨天的签到记录来计算连续签到
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayCheckIn = await this.prisma.checkIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: yesterdayStr,
        },
      },
    });

    // 计算连续签到天数
    let streak = 1;
    let reward = '';
    if (yesterdayCheckIn) {
      streak = yesterdayCheckIn.streak + 1;
    }

    // 根据连续签到天数计算积分奖励
    let points = 10;
    if (streak >= 7) {
      points = 30;
      reward = '连续签到7天奖励';
    } else if (streak >= 30) {
      points = 100;
      reward = '连续签到30天奖励';
    } else if (streak >= 3) {
      points = 10 + Math.floor(streak / 3) * 5;
      reward = `连续签到${streak}天奖励`;
    }

    // 创建签到记录
    await this.prisma.checkIn.create({
      data: {
        userId,
        date: today,
        streak,
        points,
        reward: reward || null,
      },
    });

    // 创建或更新用户积分
    let userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    if (!userPoints) {
      userPoints = await this.prisma.userPoints.create({
        data: {
          userId,
          totalPoints: points,
          availablePoints: points,
        },
      });
    } else {
      userPoints = await this.prisma.userPoints.update({
        where: { userId },
        data: {
          totalPoints: { increment: points },
          availablePoints: { increment: points },
        },
      });
    }

    // 记录积分变动
    await this.prisma.pointRecord.create({
      data: {
        userId,
        points,
        type: 'checkin',
        description: `签到奖励${streak > 1 ? `（连续${streak}天）` : ''}`,
      },
    });

    // 检查并解锁成就
    let unlockedAchievement: {
      name: string;
      description: string;
      icon: string;
    } | null = null;
    if (this.achievementService) {
      const achievement = await this.achievementService.checkLoginAchievements(userId, streak);
      if (achievement) {
        // 奖励成就积分
        if (achievement.points > 0) {
          await this.prisma.userPoints.update({
            where: { userId },
            data: {
              totalPoints: { increment: achievement.points },
              availablePoints: { increment: achievement.points },
            },
          });
          
          await this.prisma.pointRecord.create({
            data: {
              userId,
              points: achievement.points,
              type: 'reward',
              description: `成就奖励：${achievement.name}`,
            },
          });
        }
        
        unlockedAchievement = {
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon || '🏆',
        };
      }
    }

    const isFirstCheckIn = streak === 1;

    return {
      success: true,
      message: streak === 1 ? '签到成功，欢迎回来！' : `已连续签到 ${streak} 天`,
      streak,
      points,
      reward: reward || undefined,
      isFirstCheckIn,
      ...(unlockedAchievement ? { unlockedAchievement } : {}),
    };
  }

  /**
   * 获取签到状态
   */
  async getCheckInStatus(userId: string): Promise<CheckInStatus> {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今天是否已签到
    const todayCheckIn = await this.prisma.checkIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    // 获取用户的总积分
    const allCheckIns = await this.prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const totalPoints = allCheckIns.reduce((sum, checkIn) => sum + checkIn.points, 0);
    
    // 获取当前连续签到天数
    const currentStreak = todayCheckIn?.streak || 0;

    // 计算历史最长连续签到
    let consecutiveDays = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;
    
    for (const checkIn of allCheckIns) {
      const checkInDate = new Date(checkIn.date);
      
      if (!lastDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.floor((lastDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          break;
        }
      }
      lastDate = checkInDate;
      consecutiveDays = tempStreak;
    }

    return {
      todayCheckedIn: !!todayCheckIn,
      currentStreak,
      totalPoints,
      consecutiveDays,
    };
  }

  /**
   * 获取签到日历（最近30天）
   */
  async getCheckInCalendar(userId: string): Promise<string[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        userId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      select: { date: true },
    });

    return checkIns.map(c => c.date);
  }
}
