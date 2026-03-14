import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ZiService, HandwritingAnalysis } from './zi.service';
import { OcrService } from '../ocr/ocr.service';
import { PointsService } from '../points/points.service';

export class AnalyzeZiDto {
  @IsString()
  zi: string;
  
  handwriting?: Partial<HandwritingAnalysis>;

  @IsOptional()
  @IsString()
  focusAspect?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class RecognizeDto {
  @IsString()
  image: string; // base64
}

export class AnalyzeHandwritingDto {
  @IsString()
  image: string; // base64

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  focusAspect?: string;
}

const ZI_POINTS_COST = 10;

@Controller('zi')
export class ZiController {
  private prisma = new PrismaClient();

  constructor(
    private readonly ziService: ZiService,
    private readonly ocrService: OcrService,
    private readonly pointsService: PointsService,
  ) {}

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeZiDto) {
    const zi = String(dto.zi || '').trim().charAt(0);
    if (!/[\u4e00-\u9fa5]/.test(zi)) {
      throw new BadRequestException('请输入一个有效的汉字');
    }
    const membership = await this.getMembership(dto.userId);
    if (dto.userId && membership === 'free') {
      const consumed = await this.pointsService.consumePoints(
        dto.userId,
        ZI_POINTS_COST,
        'zi',
        '测字解读',
      );
      if (!consumed.success) {
        throw new BadRequestException(consumed.message || '积分不足，请签到或前往积分商城获取');
      }
    }
    const result = await this.ziService.analyze(zi, dto.handwriting, membership, dto.focusAspect);

    // 保存测字记录
    if (dto.userId) {
      try {
        await this.prisma.ziAnalysis.create({
          data: {
            userId: dto.userId,
            zi,
            pressure: result.handwriting.pressure,
            pressureInterpretation: result.handwriting.pressureInterpretation,
            stability: result.handwriting.stability,
            stabilityInterpretation: result.handwriting.stabilityInterpretation,
            structure: result.handwriting.structure,
            structureInterpretation: result.handwriting.structureInterpretation,
            continuity: result.handwriting.continuity,
            continuityInterpretation: result.handwriting.continuityInterpretation,
            overallStyle: result.handwriting.overallStyle,
            personalityInsights: JSON.stringify(result.handwriting.personalityInsights),
            interpretation: result.interpretation.overall,
            coldReadings: JSON.stringify(result.coldReadings),
            followUpQuestions: JSON.stringify(result.followUpQuestions),
          },
        });
      } catch (error) {
        Logger.error('保存测字记录失败', (error as Error).message, ZiController.name);
      }
    }

    return result;
  }

  @Post('recognize')
  async recognize(@Body() dto: RecognizeDto) {
    console.log('收到 recognize 请求, dto:', dto);
    const result = await this.ocrService.recognizeHandwriting(dto.image);
    return {
      recognizedZi: result.zi,
      confidence: result.confidence,
    };
  }

  @Post('analyze-handwriting')
  async analyzeHandwriting(@Body() dto: AnalyzeHandwritingDto) {
    try {
      // 1. 识别文字
      const ocrResult = await this.ocrService.recognizeHandwriting(dto.image);
      const zi = ocrResult.zi;
      
      if (!zi) {
        return {
          recognizedZi: null,
          error: '未能识别出汉字',
        };
      }
      
      // 2. 积分消耗（非 VIP 用户）
      const membership = await this.getMembership(dto.userId);
      if (dto.userId && membership === 'free') {
        const consumed = await this.pointsService.consumePoints(
          dto.userId,
          ZI_POINTS_COST,
          'zi',
          '测字解读（手写）',
        );
        if (!consumed.success) {
          return {
            recognizedZi: zi,
            error: consumed.message || '积分不足，请签到或前往积分商城获取',
          };
        }
      }
      
      // 3. 分析字义
      const analysis = await this.ziService.analyze(zi, undefined, membership, dto.focusAspect);
      
      // 保存测字记录
      if (dto.userId) {
        try {
          await this.prisma.ziAnalysis.create({
            data: {
              userId: dto.userId,
              zi,
              pressure: analysis.handwriting.pressure,
              pressureInterpretation: analysis.handwriting.pressureInterpretation,
              stability: analysis.handwriting.stability,
              stabilityInterpretation: analysis.handwriting.stabilityInterpretation,
              structure: analysis.handwriting.structure,
              structureInterpretation: analysis.handwriting.structureInterpretation,
              continuity: analysis.handwriting.continuity,
              continuityInterpretation: analysis.handwriting.continuityInterpretation,
              overallStyle: analysis.handwriting.overallStyle,
              personalityInsights: JSON.stringify(analysis.handwriting.personalityInsights),
              interpretation: analysis.interpretation.overall,
              coldReadings: JSON.stringify(analysis.coldReadings),
              followUpQuestions: JSON.stringify(analysis.followUpQuestions),
              confidence: ocrResult.confidence,
            },
          });
        } catch (error) {
          Logger.error('保存测字记录失败', (error as Error).message, ZiController.name);
        }
      }

      return {
        recognizedZi: zi,
        confidence: ocrResult.confidence,
        analysis,
      };
    } catch (error) {
      console.error('analyze-handwriting 错误:', error);
      return {
        recognizedZi: null,
        error: error.message || '服务器错误',
      };
    }
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
      Logger.warn(`读取用户会员失败: ${(error as Error).message}`, ZiController.name);
    }
    return 'free';
  }
}
