import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PointsService, PointsSummary, PointRecord } from './points.service';
import { JwtAuthGuard, RequireAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma.service';
import { BILLING_RULES } from '../../config/billing-rules';

@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly prisma: PrismaService,
  ) {}

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
    @Query('limit') limit?: string,
  ): Promise<PointRecord[]> {
    const userId = req.user.sub;
    const parsed = limit ? parseInt(limit, 10) : 20;
    const n = Number.isFinite(parsed) ? parsed : 20;
    return this.pointsService.getPointRecords(userId, n);
  }

  /**
   * 获取扣费与权益规则（用于前端统一展示与引导）
   */
  @Get('rules')
  @UseGuards(JwtAuthGuard)
  async getBillingRules(@Request() req) {
    const userId = req.user?.sub ?? req.user?.id;
    let membership: 'free' | 'premium' | 'vip' = 'free';
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { membership: true, membershipExpiryAt: true },
      });
      const m = user?.membership;
      if (
        (m === 'premium' || m === 'vip') &&
        (!user?.membershipExpiryAt || user.membershipExpiryAt > new Date())
      ) {
        membership = m;
      }
    }
    return {
      gateEnabled: !this.pointsService.isPointsGateDisabled(),
      costs: {
        zi: BILLING_RULES.points.zi,
        reading: BILLING_RULES.points.reading,
      },
      membershipExemptions: {
        zi: true,
        reading: true,
        baziAdvanced: true,
      },
      paywalls: {
        baziAdvancedMode: BILLING_RULES.baziAdvancedMode,
      },
      currentUser: {
        membership,
        isMember: membership === 'premium' || membership === 'vip',
      },
    };
  }

  /**
   * 会员价值快照（用于会员页展示“已节省/使用情况”）
   */
  @Get('membership-value')
  @UseGuards(RequireAuthGuard)
  async getMembershipValue(@Request() req) {
    const userId = req.user.sub;
    return this.pointsService.getMembershipValueSnapshot(userId);
  }

  /**
   * 消费积分（需要登录）
   */
  @Post('consume')
  @UseGuards(RequireAuthGuard)
  async consumePoints(
    @Request() req,
    @Body() dto: { points: number; type: string; description: string },
  ) {
    const userId = req.user.sub;

    if (dto.points <= 0) {
      return { success: false, message: '积分数量必须大于0' };
    }

    return this.pointsService.consumePoints(
      userId,
      dto.points,
      dto.type,
      dto.description,
    );
  }

  /**
   * 检查积分是否足够（可选登录：未登录或 token 无效时返回 hasEnough: false，避免 401 误清前端会话）
   */
  @Post('check')
  @UseGuards(JwtAuthGuard)
  async checkPoints(@Request() req, @Body() dto: { points: number }) {
    const need = Number(dto?.points);
    if (!Number.isFinite(need) || need <= 0) {
      return { success: true, hasEnough: true };
    }
    // 门闸关闭时须直接放行：否则未带 token / token 未解析到 user 时会误返回 hasEnough:false，前端会拦截
    if (this.pointsService.isPointsGateDisabled()) {
      return { success: true, hasEnough: true };
    }
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      return { success: true, hasEnough: false };
    }
    const hasEnough = await this.pointsService.hasEnoughPoints(userId, need);
    return { success: true, hasEnough };
  }
}
