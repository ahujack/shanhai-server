import { Body, Controller, Post } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';

@Controller('readings')
export class ReadingController {
  private prisma = new PrismaClient();

  constructor(private readonly readingService: ReadingService) {}

  @Post()
  async create(@Body() dto: CreateReadingDto) {
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
}

