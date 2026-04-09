import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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

/**
 * 积分与流水约定：
 * - 凡变动 UserPoints（available/total），须在同一业务路径写入 PointRecord（awardPoints / consumePoints / 与之一致的事务）。
 * - 签到事务内手写积分与流水见 checkin.service，须与此处字段语义保持一致。
 */
@Injectable()
export class PointsService implements OnModuleInit {
  private readonly logger = new Logger(PointsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 默认不扣积分、不校验余额（便于全环境测试效果）。
   * 正式对用户扣分时设置 POINTS_GATE_ENFORCED=true（优先于下方变量）。
   * 若需显式声明「要扣积分」也可设 DISABLE_POINTS_GATE=false。
   */
  /** 供 PointsController 预检等使用：门闸关闭时不应因「未识别到用户」而返回 hasEnough:false */
  isPointsGateDisabled(): boolean {
    const enforced = process.env.POINTS_GATE_ENFORCED?.trim().toLowerCase();
    if (enforced === 'true' || enforced === '1' || enforced === 'yes') {
      return false;
    }
    const disableGate = process.env.DISABLE_POINTS_GATE?.trim().toLowerCase();
    if (disableGate === 'false' || disableGate === '0' || disableGate === 'no') {
      return false;
    }
    return true;
  }

  async onModuleInit() {
    if (this.isPointsGateDisabled()) {
      this.logger.warn(
        '积分门闸已关闭：测字/占卜等不扣积分。正式启用扣费请设置 POINTS_GATE_ENFORCED=true。',
      );
    } else {
      this.logger.log('Points Service 已初始化（积分门闸已启用）');
    }
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

    const [earnedAgg, spentAgg] = await Promise.all([
      this.prisma.pointRecord.aggregate({
        where: { userId, points: { gt: 0 } },
        _sum: { points: true },
      }),
      this.prisma.pointRecord.aggregate({
        where: { userId, points: { lt: 0 } },
        _sum: { points: true },
      }),
    ]);

    const totalEarned = earnedAgg._sum.points ?? 0;
    const totalSpent = Math.abs(spentAgg._sum.points ?? 0);
    
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
    const raw = limit ?? 20;
    const take = Math.min(Math.max(Number.isFinite(raw) ? raw : 20, 1), 100);
    return this.prisma.pointRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * 消费积分（用于兑换服务）- 使用事务保证原子性
   */
  async consumePoints(
    userId: string, 
    points: number, 
    type: string, 
    description: string
  ): Promise<{ success: boolean; message: string; remainingPoints?: number; recordId?: string }> {
    if (this.isPointsGateDisabled()) {
      const userPoints = await this.prisma.userPoints.findUnique({
        where: { userId },
      });
      return {
        success: true,
        message: '积分门闸已关闭（测试）',
        remainingPoints: userPoints?.availablePoints ?? 0,
      };
    }
    return this.prisma.$transaction(async (tx) => {
      const userPoints = await tx.userPoints.findUnique({
        where: { userId },
      });
      
      if (!userPoints || userPoints.availablePoints < points) {
        return {
          success: false,
          message: '积分不足',
        };
      }
      
      await tx.userPoints.update({
        where: { userId },
        data: { availablePoints: { decrement: points } },
      });
      
      const record = await tx.pointRecord.create({
        data: {
          userId,
          points: -points,
          type,
          description,
        },
      });
      
      const updated = await tx.userPoints.findUnique({
        where: { userId },
      });
      
      return {
        success: true,
        message: '积分消费成功',
        remainingPoints: updated?.availablePoints ?? 0,
        recordId: record.id,
      };
    });
  }

  /**
   * 撤销一笔消费（用于“先扣费后执行”场景下的失败回滚）
   * - 幂等：同一 record 多次回滚仅首个生效
   * - 审计：保留原记录，将 points 置 0 并标记 rolled_back
   */
  async rollbackConsumption(
    userId: string,
    recordId: string,
    reason = 'service_failed',
  ): Promise<{ success: boolean; message: string; refundedPoints?: number }> {
    if (!recordId) {
      return { success: false, message: 'recordId 不能为空' };
    }
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.pointRecord.findFirst({
        where: { id: recordId, userId },
      });
      if (!record) {
        return { success: false, message: '消费记录不存在' };
      }
      // 已回滚或非消费记录，视为幂等成功
      if (record.points >= 0 || record.type.endsWith('_rolled_back')) {
        return {
          success: true,
          message: '消费记录已回滚',
          refundedPoints: Math.max(0, -record.points),
        };
      }
      const refundPoints = Math.abs(record.points);
      await tx.userPoints.update({
        where: { userId },
        data: { availablePoints: { increment: refundPoints } },
      });
      await tx.pointRecord.update({
        where: { id: record.id },
        data: {
          points: 0,
          type: `${record.type}_rolled_back`,
          description: `${record.description || ''} [ROLLBACK:${reason}]`.trim(),
        },
      });
      this.logger.warn(
        `积分消费已回滚 userId=${userId} recordId=${record.id} refunded=${refundPoints} reason=${reason}`,
      );
      return {
        success: true,
        message: '消费已回滚',
        refundedPoints: refundPoints,
      };
    });
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
    return this.prisma.$transaction(async (tx) => {
      let userPoints = await tx.userPoints.findUnique({
        where: { userId },
      });
      
      if (!userPoints) {
        userPoints = await tx.userPoints.create({
          data: {
            userId,
            totalPoints: points,
            availablePoints: points,
          },
        });
      } else {
        await tx.userPoints.update({
          where: { userId },
          data: {
            totalPoints: { increment: points },
            availablePoints: { increment: points },
          },
        });
      }
      
      await tx.pointRecord.create({
        data: {
          userId,
          points,
          type,
          description,
        },
      });
      
      const updated = await tx.userPoints.findUnique({
        where: { userId },
      });
      
      return {
        success: true,
        newBalance: updated?.availablePoints ?? 0,
      };
    });
  }

  /**
   * 成就解锁后的钱包积分：与 UserAchievement 写入配套，统一走本方法以便生成 PointRecord。
   * （注册时仅解锁徽章、积分已由 referral/register 等单独发放的场景，不要重复调用。）
   */
  async awardAchievementWalletBonus(
    userId: string,
    achievement: { name: string; points: number },
  ): Promise<void> {
    const pts = achievement.points;
    if (!pts || pts <= 0) return;
    try {
      await this.awardPoints(userId, pts, 'achievement', `成就奖励：${achievement.name}`);
    } catch (e) {
      this.logger.error(`成就积分发放失败 userId=${userId} achievement=${achievement.name}`, (e as Error)?.stack);
    }
  }

  /**
   * 检查积分是否足够
   */
  async hasEnoughPoints(userId: string, points: number): Promise<boolean> {
    if (this.isPointsGateDisabled()) {
      return true;
    }
    const userPoints = await this.prisma.userPoints.findUnique({
      where: { userId },
    });
    
    return !!userPoints && userPoints.availablePoints >= points;
  }
}
