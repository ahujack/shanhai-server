import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ChartService, type BaziChart } from '../chart/chart.service';

export type DestinyReportStatus = 'generating' | 'awaiting_profile' | 'ready' | 'failed';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chartService: ChartService,
  ) {}

  /**
   * 支付成功后履约：生成并持久化一份可重开的 VIP 级命运报告快照。
   * 幂等：同一 paymentId 已 ready 则直接返回。
   */
  async fulfillDeepDestinyReport(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { product: true },
    });
    if (!payment) {
      throw new NotFoundException('支付记录不存在');
    }
    if (payment.userId !== userId) {
      throw new BadRequestException('无权生成该报告');
    }
    if (payment.status !== 'completed') {
      throw new BadRequestException('支付尚未完成');
    }
    if (payment.product.code !== 'deep_destiny_report') {
      throw new BadRequestException('该订单不是深度命运报告');
    }

    const existing = await this.prisma.destinyReport.findUnique({
      where: { paymentId },
    });
    if (existing?.status === 'ready' && existing.payload) {
      return this.toDto(existing);
    }

    const report =
      existing ??
      (await this.prisma.destinyReport.create({
        data: {
          userId,
          paymentId,
          status: 'generating',
          title: '深度命运报告',
          payload: {},
        },
      }));

    if (report.status !== 'generating') {
      await this.prisma.destinyReport.update({
        where: { id: report.id },
        data: { status: 'generating', errorMessage: null },
      });
    }

    try {
      const chart = await this.resolveVipChart(userId);
      if (!chart) {
        const pendingPayload: Prisma.InputJsonValue = {
          version: 1,
          message:
            '已购得深度命运报告。请先完善出生年月日时与性别，保存命盘后即可生成完整报告。',
          bonusVipDays: payment.product.periodDays || 30,
        };
        const updated = await this.prisma.destinyReport.update({
          where: { id: report.id },
          data: {
            status: 'awaiting_profile',
            payload: pendingPayload,
            errorMessage: null,
          },
        });
        return this.toDto(updated);
      }

      const payload = this.buildPayload(chart, payment.product.periodDays || 30);
      const updated = await this.prisma.destinyReport.update({
        where: { id: report.id },
        data: {
          status: 'ready',
          title: '深度命运报告',
          payload,
          errorMessage: null,
        },
      });
      this.logger.log(
        `Destiny report ready reportId=${updated.id} paymentId=${paymentId} userId=${userId}`,
      );
      return this.toDto(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : '报告生成失败';
      this.logger.error(
        `Destiny report failed paymentId=${paymentId} userId=${userId}: ${message}`,
      );
      const failed = await this.prisma.destinyReport.update({
        where: { id: report.id },
        data: {
          status: 'failed',
          errorMessage: message.slice(0, 500),
        },
      });
      return this.toDto(failed);
    }
  }

  /** 若报告缺失或仍等待资料，尝试补生成（支付状态查询 / 用户打开报告页时） */
  async ensureDeepDestinyReport(userId: string, paymentId: string) {
    const existing = await this.prisma.destinyReport.findUnique({
      where: { paymentId },
    });
    if (existing?.status === 'ready' && existing.payload) {
      return this.toDto(existing);
    }
    return this.fulfillDeepDestinyReport(userId, paymentId);
  }

  async getLatestForUser(userId: string) {
    const report = await this.prisma.destinyReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!report) {
      return null;
    }
    if (report.status === 'awaiting_profile' || report.status === 'failed') {
      return this.ensureDeepDestinyReport(userId, report.paymentId);
    }
    return this.toDto(report);
  }

  async getByPaymentId(userId: string, paymentId: string) {
    const report = await this.prisma.destinyReport.findUnique({
      where: { paymentId },
    });
    if (!report) {
      // 兼容历史已付款但未落报告的订单
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { product: true },
      });
      if (
        payment &&
        payment.userId === userId &&
        payment.status === 'completed' &&
        payment.product.code === 'deep_destiny_report'
      ) {
        return this.fulfillDeepDestinyReport(userId, paymentId);
      }
      throw new NotFoundException('报告不存在');
    }
    if (report.userId !== userId) {
      throw new BadRequestException('无权查看该报告');
    }
    if (report.status === 'awaiting_profile' || report.status === 'failed') {
      return this.ensureDeepDestinyReport(userId, paymentId);
    }
    return this.toDto(report);
  }

  private async resolveVipChart(userId: string): Promise<BaziChart | null> {
    let chart = await this.chartService.findOne(userId, 'vip', 'zh-CN');
    if (chart) return chart;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        birthDate: true,
        birthTime: true,
        gender: true,
        calendarType: true,
        isLeapMonth: true,
        birthLongitude: true,
        birthLocation: true,
        timezone: true,
      },
    });
    if (!user?.birthDate || !user?.birthTime || !user?.gender) {
      return null;
    }
    if (user.gender !== 'male' && user.gender !== 'female') {
      return null;
    }

    chart = await this.chartService.generateChart(
      userId,
      user.birthDate,
      user.birthTime,
      user.gender,
      {
        calendarType: (user.calendarType as 'solar' | 'lunar') || 'solar',
        isLeapMonth: user.isLeapMonth || false,
        birthLongitude: user.birthLongitude ?? undefined,
        birthLocation: user.birthLocation ?? undefined,
        timezone: user.timezone || 'Asia/Shanghai',
        membership: 'vip',
        language: 'zh-CN',
        persist: true,
      },
    );
    return chart;
  }

  private buildPayload(chart: BaziChart, bonusVipDays: number): Prisma.InputJsonValue {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      bonusVipDays,
      pillars: {
        year: chart.yearGanZhi,
        month: chart.monthGanZhi,
        day: chart.dayGanZhi,
        hour: chart.hourGanZhi,
      },
      dayMaster: chart.dayMaster,
      tenGods: chart.tenGods,
      wuxingStrength: chart.wuxingStrength,
      personalityTraits: chart.personalityTraits,
      fortuneSummary: chart.fortuneSummary,
      suggestions: chart.suggestions,
      conclusion: chart.conclusion,
      detailedReading: chart.detailedReading,
      birth: {
        birthDate: chart.birthDate,
        birthTime: chart.birthTime,
        gender: chart.gender,
      },
    } as Prisma.InputJsonValue;
  }

  private toDto(report: {
    id: string;
    userId: string;
    paymentId: string;
    status: string;
    title: string;
    payload: Prisma.JsonValue | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: report.id,
      userId: report.userId,
      paymentId: report.paymentId,
      status: report.status as DestinyReportStatus,
      title: report.title,
      payload: report.payload,
      errorMessage: report.errorMessage,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }
}
