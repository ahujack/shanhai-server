import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface UserPoints {
  userId: string;
  totalPoints: number;
  availablePoints: number;
}

export interface PointRecord {
  id: string;
  userId: string;
  points: number;
  type: string;
  description?: string | null;
  createdAt: Date;
}

export interface PointsSummary {
  totalPoints: number;
  availablePoints: number;
  totalEarned: number;
  totalSpent: number;
}

@Injectable()
export class PointsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log('Points Service 已初始化');
  }

  /**
   * 获取用户积分概况
   */
  async getUserPointsSummary(userId: string): Promise<PointsSummary> {
    const userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    if (!userPoints) {
      return {
        totalPoints: 0,
        availablePoints: 0,
        totalEarned: 0,
        totalSpent: 0,
      };
    }
    
    // 计算总收入和总支出
    const earnedRecords = await this.prisma.pointRecord.findMany({
      where: { userId, points: { gt: 0 } },
    });
    
    const spentRecords = await this.prisma.pointRecord.findMany({
      where: { userId, points: { lt: 0 } },
    });
    
    const totalEarned = earnedRecords.reduce((sum, r) => sum + r.points, 0);
    const totalSpent = Math.abs(spentRecords.reduce((sum, r) => sum + r.points, 0));
    
    return {
      totalPoints: userPoints.totalPoints,
      availablePoints: userPoints.availablePoints,
      totalEarned,
      totalSpent,
    };
  }

  /**
   * 获取积分记录
   */
  async getPointRecords(userId: string, limit = 20): Promise<PointRecord[]> {
    return this.prisma.pointRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 消费积分（用于兑换服务）
   */
  async consumePoints(
    userId: string, 
    points: number, 
    type: string, 
    description: string
  ): Promise<{ success: boolean; message: string; remainingPoints?: number }> {
    const userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    if (!userPoints || userPoints.availablePoints < points) {
      return {
        success: false,
        message: '积分不足',
      };
    }
    
    // 扣除积分
    await this.prisma.userPoints.update({
      where: { userId },
      data: {
        availablePoints: { decrement: points },
      },
    });
    
    // 记录积分变动
    await this.prisma.pointRecord.create({
      data: {
        userId,
        points: -points,
        type,
        description,
      },
    });
    
    // 获取剩余积分
    const updatedUserPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    return {
      success: true,
      message: '积分消费成功',
      remainingPoints: updatedUserPoints?.availablePoints || 0,
    };
  }

  /**
   * 奖励积分（用于系统赠送）
   */
  async awardPoints(
    userId: string,
    points: number,
    type: string,
    description: string
  ): Promise<{ success: boolean; newBalance?: number }> {
    // 确保用户积分记录存在
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
      await this.prisma.userPoints.update({
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
        type,
        description,
      },
    });
    
    const updatedUserPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    return {
      success: true,
      newBalance: updatedUserPoints?.availablePoints || 0,
    };
  }

  /**
   * 检查积分是否足够
   */
  async hasEnoughPoints(userId: string, points: number): Promise<boolean> {
    const userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    return !!userPoints && userPoints.availablePoints >= points;
  }
}
