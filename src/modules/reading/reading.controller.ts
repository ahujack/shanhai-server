import { Body, Controller, Post, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../../prisma.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

const READING_POINTS_COST = parseInt(process.env.READING_POINTS_COST || '15', 10);

@Controller('readings')
export class ReadingController {
  constructor(
    private readonly readingService: ReadingService,
    private readonly pointsService: PointsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(RequireAuthGuard)
  async create(@Body() dto: CreateReadingDto, @Req() req: { user: { sub: string } }) {
    const userId = req.user.sub;
    const membership = await this.getMembership(userId);
    if (membership === 'free') {
      const consumed = await this.pointsService.consumePoints(
        userId,
        READING_POINTS_COST,
        'reading',
        '占卜解读',
      );
      if (!consumed.success) {
        throw new BadRequestException(consumed.message || '积分不足，请签到或前往积分商城获取');
      }
    }
    const result = await this.readingService.generate({ ...dto, userId });

    // 保存占卜记录
    try {
      await this.prisma.reading.create({
        data: {
          userId,
          question: dto.question,
          category: dto.category,
          result: JSON.stringify(result),
        },
      });
    } catch (error) {
      Logger.error('保存占卜记录失败', (error as Error).message, ReadingController.name);
    }

    return result;
  }

  private async getMembership(userId: string): Promise<'free' | 'premium' | 'vip'> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { membership: true, membershipExpiryAt: true },
      });
      const membership = user?.membership;
      if (membership === 'premium' || membership === 'vip') {
        if (user?.membershipExpiryAt && new Date() > user.membershipExpiryAt) {
          return 'free';
        }
        return membership;
      }
    } catch (error) {
      Logger.warn(`读取用户会员失败: ${(error as Error).message}`, ReadingController.name);
    }
    return 'free';
  }
}

