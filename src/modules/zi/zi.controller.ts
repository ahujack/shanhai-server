import { Body, Controller, Post, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { Logger } from '@nestjs/common';
import { ZiService, HandwritingAnalysis, ZiBaziContext } from './zi.service';
import { OcrService } from '../ocr/ocr.service';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const ZI_POINTS_COST = parseInt(process.env.ZI_POINTS_COST || '10', 10);

export class AnalyzeZiDto {
  @IsString()
  zi: string;
  
  handwriting?: Partial<HandwritingAnalysis>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  focusAspect?: string;
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
  @MaxLength(50)
  focusAspect?: string;
}

@Controller('zi')
export class ZiController {
  constructor(
    private readonly ziService: ZiService,
    private readonly ocrService: OcrService,
    private readonly pointsService: PointsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('analyze')
  @UseGuards(JwtAuthGuard)
  async analyze(@Body() dto: AnalyzeZiDto, @Req() req: { user?: { sub?: string; id?: string } }) {
    const userId = req.user?.sub ?? req.user?.id;
    const zi = String(dto.zi || '').trim().charAt(0);
    if (!/[\u4e00-\u9fa5]/.test(zi)) {
      throw new BadRequestException('请输入一个有效的汉字');
    }
    const membership = await this.getMembership(userId);
    if (membership === 'free' && userId) {
      const consumed = await this.pointsService.consumePoints(
        userId,
        ZI_POINTS_COST,
        'zi',
        '测字解读',
      );
      if (!consumed.success) {
        throw new BadRequestException(consumed.message || '积分不足，请签到或前往积分商城获取');
      }
    }
    const chartCtx = await this.buildZiBaziContext(userId);
    const result = await this.ziService.analyze(zi, dto.handwriting, membership, dto.focusAspect, chartCtx);

    if (userId) {
      try {
        await this.prisma.ziAnalysis.create({
          data: {
            userId,
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
  @UseGuards(JwtAuthGuard)
  async recognize(@Body() dto: RecognizeDto) {
    const result = await this.ocrService.recognizeHandwriting(dto.image);
    return {
      recognizedZi: result.zi,
      confidence: result.confidence,
    };
  }

  @Post('analyze-handwriting')
  @UseGuards(JwtAuthGuard)
  async analyzeHandwriting(@Body() dto: AnalyzeHandwritingDto, @Req() req: { user?: { sub?: string; id?: string } }) {
    const userId = req.user?.sub ?? req.user?.id;
    try {
      const [ocrResult, visionHw] = await Promise.all([
        this.ocrService.recognizeHandwriting(dto.image),
        this.ocrService.inferHandwritingTraitsWithGemini(dto.image),
      ]);
      const zi = ocrResult.zi;

      if (!zi) {
        return {
          recognizedZi: null,
          error: '未能识别出汉字',
        };
      }

      const membership = await this.getMembership(userId);
      if (membership === 'free' && userId) {
        const consumed = await this.pointsService.consumePoints(
          userId,
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

      const chartCtx = await this.buildZiBaziContext(userId);
      let visionNote: string | undefined;
      let preserveVision = false;
      const hwPayload: Partial<HandwritingAnalysis> | undefined =
        visionHw && visionHw.pressure ? { ...visionHw } : undefined;
      if (hwPayload) {
        preserveVision = true;
        visionNote = [
          `多模态笔迹观察：力度${hwPayload.pressure}，稳定${hwPayload.stability}，结构${hwPayload.structure}，连贯${hwPayload.continuity}`,
          hwPayload.pressureInterpretation,
          hwPayload.stabilityInterpretation,
        ]
          .filter(Boolean)
          .join('；')
          .slice(0, 800);
      }

      const analysis = await this.ziService.analyze(
        zi,
        hwPayload,
        membership,
        dto.focusAspect,
        chartCtx,
        { visionHandwritingNote: visionNote, preserveVisionHandwriting: preserveVision },
      );

      if (userId) {
        try {
          await this.prisma.ziAnalysis.create({
            data: {
              userId,
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

  private async buildZiBaziContext(userId?: string): Promise<ZiBaziContext | null> {
    if (!userId) return null;
    try {
      const row = await this.prisma.baziChart.findUnique({ where: { userId } });
      if (!row) return null;
      let wx: Record<string, number> = {};
      try {
        wx = JSON.parse(row.wuxingStrength || '{}') as Record<string, number>;
      } catch {
        /* ignore */
      }
      const sorted = Object.entries(wx).sort((a, b) => Number(b[1]) - Number(a[1]));
      const wuxingSummary =
        sorted
          .slice(0, 3)
          .map(([k, v]) => `${k}${Math.round(Number(v))}`)
          .join(' ') || '未定';
      return {
        pillars: `${row.yearGanZhi} ${row.monthGanZhi} ${row.dayGanZhi} ${row.hourGanZhi}`,
        dayMaster: row.dayMaster,
        dayPillar: row.dayGanZhi,
        wuxingSummary,
        wuxingStrength: wx,
        gender: row.gender,
      };
    } catch {
      return null;
    }
  }

  private async getMembership(userId?: string): Promise<'free' | 'premium' | 'vip'> {
    if (!userId) {
      return 'free';
    }
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
      Logger.warn(`读取用户会员失败: ${(error as Error).message}`, ZiController.name);
    }
    return 'free';
  }
}
