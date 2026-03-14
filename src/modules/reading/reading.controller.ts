import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { PointsService } from '../points/points.service';

const READING_POINTS_COST = 15;

@Controller('readings')
export class ReadingController {
  private prisma = new PrismaClient();

  constructor(
    private readonly readingService: ReadingService,
    private readonly pointsService: PointsService,
  ) {}

  @Post()
  async create(@Body() dto: CreateReadingDto) {
    if (dto.userId) {
      const membership = await this.getMembership(dto.userId);
      if (membership === 'free') {
        const consumed = await this.pointsService.consumePoints(
          dto.userId,
          READING_POINTS_COST,
          'reading',
          '占卜解读',
        );
        if (!consumed.success) {
          throw new BadRequestException(consumed.message || '积分不足，请签到或前往积分商城获取');
        }
      }
    }
    const result = await this.readingService.generate(dto);

    // 保存占卜记录
    if (dto.userId) {
      try {
        await this.prisma.reading.create({
          data: {
            userId: dto.userId,
            question: dto.question,
            category: dto.category,
            result: JSON.stringify(result),
          },
        });
      } catch (error) {
        Logger.error('保存占卜记录失败', (error as Error).message, ReadingController.name);
      }
    }

    return result;
  }

  private async getMembership(userId?: string): Promise<'free' | 'premium' | 'vip'> {
    if (!userId) return 'free';
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { membership: true },
      });
      const membership = user?.membership;
      if (membership === 'premium' || membership === 'vip') return membership;
    } catch (error) {
      Logger.warn(`读取用户会员失败: ${(error as Error).message}`, ReadingController.name);
    }
    return 'free';
  }
}

