import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma.service';
import type { SubmitFeedbackDto, TrackEventsDto } from './dto/analytics.dto';

function extractIp(req: Request): string | null {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0]?.trim().slice(0, 64) || null;
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).split(',')[0]?.trim().slice(0, 64) || null;
  }
  const raw = req.ip || (req.socket && req.socket.remoteAddress);
  return raw ? String(raw).slice(0, 64) : null;
}

function pickCountry(req: Request): string | null {
  const h = req.headers;
  const cf = h['cf-ipcountry'];
  const vc = h['x-vercel-ip-country'];
  const v =
    (typeof cf === 'string' ? cf : typeof vc === 'string' ? vc : '') || '';
  const t = v.trim().toUpperCase();
  if (!t || t === 'XX') return null;
  return t.slice(0, 8);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashAffiliateToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAffiliateToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  private generateAffiliateCodeCandidate(name?: string): string {
    const normalizedName = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    const prefix = normalizedName && normalizedName.length >= 3 ? normalizedName : 'AFF';
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${suffix}`.slice(0, 12);
  }

  private async generateUniqueAffiliateCode(name?: string): Promise<string> {
    for (let i = 0; i < 10; i += 1) {
      const code = this.generateAffiliateCodeCandidate(name);
      const existed = await this.prisma.affiliatePartner.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existed) return code;
    }
    throw new BadRequestException('推广码生成失败，请稍后重试');
  }

  private buildAffiliateDashboardUrl(code: string, token: string): string {
    const appUrl = (
      process.env.APP_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'https://www.shanhai.app'
    ).replace(/\/$/, '');
    const params = new URLSearchParams({ code, token });
    return `${appUrl}/partner?${params.toString()}`;
  }

  private nextSettlementDate(cycle: string, from = new Date()): string {
    const d = new Date(from);
    if (cycle === 'weekly') {
      const day = d.getUTCDay();
      const daysUntilMonday = (8 - day) % 7 || 7;
      d.setUTCDate(d.getUTCDate() + daysUntilMonday);
    } else {
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
    }
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }

  private dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildDailyTrend(
    since: Date,
    days: number,
    rows: Array<{ createdAt: Date }>,
  ): Array<{ day: string; count: number }> {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);

    const map = new Map<string, number>();
    for (let i = 0; i < safeDays; i += 1) {
      const day = new Date(start.getTime() + i * 86400000);
      map.set(this.dayKey(day), 0);
    }
    rows.forEach((row) => {
      const key = this.dayKey(row.createdAt);
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }

  recordFromRequest(
    req: Request,
    params: { userId: string; name: string; props?: Record<string, unknown> },
  ) {
    return this.prisma.analyticsEvent.create({
      data: {
        userId: params.userId,
        name: params.name,
        props: params.props
          ? (params.props as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: extractIp(req),
        country: pickCountry(req),
        userAgent:
          String(req.headers['user-agent'] ?? '').slice(0, 512) || null,
      },
    });
  }

  async ingestFromClient(
    userId: string | null,
    dto: TrackEventsDto,
    req: Request,
  ) {
    const ip = extractIp(req);
    const country = pickCountry(req);
    const ua = String(req.headers['user-agent'] ?? '').slice(0, 512) || null;
    const { locale, timezone, region } = dto.client ?? {};

    const rows = dto.events.map((e) => ({
      userId,
      name: e.name,
      props: e.props ? (e.props as Prisma.InputJsonValue) : Prisma.JsonNull,
      locale: locale?.slice(0, 64) ?? null,
      timezone: timezone?.slice(0, 128) ?? null,
      region: region?.slice(0, 64) ?? null,
      ip,
      country,
      userAgent: ua,
    }));

    await this.prisma.analyticsEvent.createMany({ data: rows });
    return { success: true, count: rows.length };
  }

  async submitFeedback(userId: string | null, dto: SubmitFeedbackDto) {
    await this.prisma.userFeedback.create({
      data: {
        userId,
        category: dto.category,
        rating: dto.rating ?? null,
        comment: dto.comment?.trim() || null,
        context: dto.context
          ? (dto.context as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    return { success: true };
  }

  async submitEmailLead(
    userId: string | null,
    dto: { email: string; source?: string },
    req: Request,
  ) {
    const email = String(dto.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('INVALID_EMAIL');
    }
    const source = String(dto.source || 'unknown').trim().slice(0, 64) || 'unknown';
    await this.prisma.userFeedback.create({
      data: {
        userId,
        category: 'email_lead',
        comment: email,
        context: {
          source,
          capturedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    if (userId) {
      await this.recordFromRequest(req, {
        userId,
        name: 'email_lead',
        props: { email, source },
      }).catch(() => null);
    } else {
      await this.prisma.analyticsEvent
        .create({
          data: {
            userId: null,
            name: 'email_lead',
            props: { email, source } as Prisma.InputJsonValue,
            ip: extractIp(req),
            country: pickCountry(req),
            userAgent: String(req.headers['user-agent'] ?? '').slice(0, 512) || null,
          },
        })
        .catch(() => null);
    }
    return { success: true };
  }

  async adminOverview(days: number) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - safeDays * 86400000);

    const [
      eventGroups,
      intentGroups,
      feedbackGroups,
      loginCount,
      userTotal,
      usersNew,
      referredUsersTotal,
      referredUsersInPeriod,
      referralBonusInPeriod,
      referralRewardInPeriod,
      referralBonusTotal,
      referralRewardTotal,
      registrationsSince,
      loginsSince,
    ] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.chatMessage.groupBy({
        by: ['intent'],
        where: {
          createdAt: { gte: since },
          intent: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.userFeedback.groupBy({
        by: ['category'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: since }, name: 'login' },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { referredBy: { not: null } } }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: since },
          referredBy: { not: null },
        },
      }),
      this.prisma.pointRecord.aggregate({
        where: {
          type: 'referral_bonus',
          createdAt: { gte: since },
        },
        _sum: { points: true },
      }),
      this.prisma.pointRecord.aggregate({
        where: {
          type: 'referral_reward',
          createdAt: { gte: since },
        },
        _sum: { points: true },
      }),
      this.prisma.pointRecord.aggregate({
        where: { type: 'referral_bonus' },
        _sum: { points: true },
      }),
      this.prisma.pointRecord.aggregate({
        where: { type: 'referral_reward' },
        _sum: { points: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: since },
          name: 'login',
        },
        select: { createdAt: true },
      }),
    ]);

    const byCountry = await this.prisma.analyticsEvent.groupBy({
      by: ['country'],
      where: {
        createdAt: { gte: since },
        country: { not: null },
      },
      _count: { _all: true },
    });

    const registrationsByDay = this.buildDailyTrend(
      since,
      safeDays,
      registrationsSince,
    );
    const loginsByDay = this.buildDailyTrend(since, safeDays, loginsSince);

    return {
      periodDays: safeDays,
      since: since.toISOString(),
      totals: {
        users: userTotal,
        newUsersInPeriod: usersNew,
        loginsInPeriod: loginCount,
      },
      referral: {
        referredUsersTotal,
        newReferredUsersInPeriod: referredUsersInPeriod,
        referralBonusInPeriod: referralBonusInPeriod._sum.points || 0,
        referralRewardInPeriod: referralRewardInPeriod._sum.points || 0,
        referralBonusTotal: referralBonusTotal._sum.points || 0,
        referralRewardTotal: referralRewardTotal._sum.points || 0,
      },
      trends: {
        registrationsByDay,
        loginsByDay,
      },
      eventsByName: eventGroups.map((g) => ({
        name: g.name,
        count: g._count._all,
      })),
      chatIntents: intentGroups.map((g) => ({
        intent: g.intent,
        count: g._count._all,
      })),
      feedbackByCategory: feedbackGroups.map((g) => ({
        category: g.category,
        count: g._count._all,
      })),
      visitsByCountry: byCountry
        .filter((g) => g.country)
        .map((g) => ({ country: g.country, count: g._count._all })),
    };
  }

  async adminRecentLogins(limit: number) {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.prisma.analyticsEvent.findMany({
      where: { name: 'login' },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            location: true,
            timezone: true,
            createdAt: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      at: r.createdAt.toISOString(),
      country: r.country,
      ip: r.ip,
      userAgent: r.userAgent,
      user: r.user
        ? {
            id: r.user.id,
            email: r.user.email,
            name: r.user.name,
            location: r.user.location,
            timezone: r.user.timezone,
            registeredAt: r.user.createdAt.toISOString(),
          }
        : null,
    }));
  }

  async adminFeedbackList(page: number, pageSize: number) {
    const p = Math.max(page, 1);
    const size = Math.min(Math.max(pageSize, 1), 100);
    const skip = (p - 1) * size;
    const [total, items] = await Promise.all([
      this.prisma.userFeedback.count(),
      this.prisma.userFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);
    return {
      total,
      page: p,
      pageSize: size,
      items: items.map((f) => ({
        id: f.id,
        category: f.category,
        rating: f.rating,
        comment: f.comment,
        context: f.context,
        createdAt: f.createdAt.toISOString(),
        user: f.user
          ? { id: f.user.id, email: f.user.email, name: f.user.name }
          : null,
      })),
    };
  }

  async adminFunnel(days: number) {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const since = new Date(Date.now() - safeDays * 86400000);
    const steps = [
      'home_view',
      'first_input_submit',
      'first_result_rendered',
      'paywall_show',
      'checkout_start',
      'payment_success',
    ] as const;
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since },
        name: { in: [...steps] },
      },
      select: {
        name: true,
        userId: true,
        createdAt: true,
        country: true,
        userAgent: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const userSteps = new Map<string, Set<string>>();
    const stepCounts = new Map<string, number>();
    steps.forEach((s) => stepCounts.set(s, 0));
    for (const row of rows) {
      if (!row.userId) continue;
      const set = userSteps.get(row.userId) || new Set<string>();
      if (!set.has(row.name)) {
        set.add(row.name);
        userSteps.set(row.userId, set);
        stepCounts.set(row.name, (stepCounts.get(row.name) || 0) + 1);
      }
    }
    const base = stepCounts.get(steps[0]) || 0;
    const perStep = steps.map((step, idx) => {
      const current = stepCounts.get(step) || 0;
      const prev = idx > 0 ? stepCounts.get(steps[idx - 1]) || 0 : current;
      return {
        step,
        users: current,
        conversionFromPrevious:
          prev > 0 ? Number(((current / prev) * 100).toFixed(2)) : 0,
        conversionFromEntry:
          base > 0 ? Number(((current / base) * 100).toFixed(2)) : 0,
      };
    });
    const byPlatform = rows.reduce<Record<string, number>>((acc, row) => {
      const ua = String(row.userAgent || '').toLowerCase();
      const platform = ua.includes('android')
        ? 'android'
        : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')
          ? 'ios'
          : ua.includes('mozilla') ||
              ua.includes('chrome') ||
              ua.includes('safari')
            ? 'web'
            : 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});
    return {
      periodDays: safeDays,
      since: since.toISOString(),
      steps: perStep,
      totals: {
        trackedEvents: rows.length,
        distinctUsers: userSteps.size,
      },
      byPlatform,
    };
  }

  async adminOpsHealth(days: number) {
    const safeDays = Math.min(Math.max(days, 1), 30);
    const since = new Date(Date.now() - safeDays * 86400000);
    const [
      checkoutStartCount,
      paymentSuccessCount,
      paymentCompletedCount,
      paymentPendingLongCount,
      paymentFailedCount,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: since },
          name: 'checkout_start',
        },
      }),
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: since },
          name: 'payment_success',
        },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: { gte: since },
          status: 'completed',
        },
      }),
      this.prisma.payment.count({
        where: {
          status: 'pending',
          createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      this.prisma.payment.count({
        where: {
          createdAt: { gte: since },
          status: { in: ['failed', 'refunded'] },
        },
      }),
    ]);
    const successRateFromCheckout =
      checkoutStartCount > 0
        ? Number(((paymentSuccessCount / checkoutStartCount) * 100).toFixed(2))
        : 0;
    const successRateFromPayments =
      checkoutStartCount > 0
        ? Number(
            ((paymentCompletedCount / checkoutStartCount) * 100).toFixed(2),
          )
        : 0;
    return {
      periodDays: safeDays,
      since: since.toISOString(),
      payment: {
        checkoutStartCount,
        analyticsPaymentSuccessCount: paymentSuccessCount,
        dbCompletedCount: paymentCompletedCount,
        pendingOver5mCount: paymentPendingLongCount,
        failedOrRefundedCount: paymentFailedCount,
        successRateFromCheckout,
        dbSuccessRateFromCheckout: successRateFromPayments,
      },
      alerts: {
        lowCheckoutConversion:
          checkoutStartCount >= 20 && successRateFromCheckout < 35,
        hasStuckPendingPayments: paymentPendingLongCount > 0,
        hasFailedPayments: paymentFailedCount > 0,
      },
    };
  }

  async adminLaunchMetrics(days: number) {
    const safeDays = Math.min(Math.max(days, 1), 30);
    const since = new Date(Date.now() - safeDays * 86400000);
    const [
      newUsers,
      activeUsers,
      chatMessages,
      ziResults,
      readingResults,
      baziCharts,
      feedbackAgg,
      checkoutStartCount,
      paymentCompletedCount,
      paymentPendingLongCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.chatMessage.count({ where: { createdAt: { gte: since } } }),
      this.prisma.ziAnalysis.count({ where: { createdAt: { gte: since } } }),
      this.prisma.reading.count({ where: { createdAt: { gte: since } } }),
      this.prisma.baziChart.count({ where: { createdAt: { gte: since } } }),
      this.prisma.userFeedback.aggregate({
        where: { createdAt: { gte: since }, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: since }, name: 'checkout_start' },
      }),
      this.prisma.payment.count({
        where: { createdAt: { gte: since }, status: 'completed' },
      }),
      this.prisma.payment.count({
        where: {
          status: 'pending',
          createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
    ]);
    return {
      periodDays: safeDays,
      since: since.toISOString(),
      users: {
        newUsers,
        activeUsers: activeUsers.length,
      },
      modules: {
        chatMessages,
        ziResults,
        readingResults,
        baziCharts,
      },
      quality: {
        feedbackCount: feedbackAgg._count.rating,
        averageRating:
          feedbackAgg._avg.rating == null
            ? null
            : Number(feedbackAgg._avg.rating.toFixed(2)),
      },
      payment: {
        checkoutStartCount,
        completedCount: paymentCompletedCount,
        pendingOver5mCount: paymentPendingLongCount,
      },
      alerts: {
        noRecentFeedback: feedbackAgg._count.rating === 0,
        hasStuckPendingPayments: paymentPendingLongCount > 0,
        lowPaymentCompletion:
          checkoutStartCount >= 10 &&
          paymentCompletedCount / Math.max(checkoutStartCount, 1) < 0.3,
      },
    };
  }

  async adminAffiliatePartners() {
    const partners = await this.prisma.affiliatePartner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            commissions: true,
            subPartners: true,
            overrideCommissions: true,
          },
        },
        parentPartner: { select: { id: true, code: true, name: true } },
      },
    });
    return partners.map((partner) => ({
      id: partner.id,
      code: partner.code,
      name: partner.name,
      email: partner.email,
      isActive: partner.isActive,
      commissionRate: partner.commissionRate,
      attributionDays: partner.attributionDays,
      recurringDays: partner.recurringDays,
      settlementCycle: partner.settlementCycle,
      minimumPayout: partner.minimumPayout,
      hasDashboardAccess: !!partner.dashboardTokenHash,
      parentPartner: partner.parentPartner,
      overrideCommissionRate: partner.overrideCommissionRate,
      createdAt: partner.createdAt,
      userCount: partner._count.users,
      commissionCount: partner._count.commissions,
      subPartnerCount: partner._count.subPartners,
      overrideCommissionCount: partner._count.overrideCommissions,
    }));
  }

  async adminCreateAffiliatePartner(input: {
    code?: string;
    name?: string;
    email?: string;
    commissionRate?: number;
    attributionDays?: number;
    recurringDays?: number;
    parentPartnerId?: string;
    overrideCommissionRate?: number;
    settlementCycle?: string;
    minimumPayout?: number;
    note?: string;
  }) {
    const requestedCode = String(input.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const name = String(input.name || '').trim();
    if (requestedCode && requestedCode.length < 3) {
      throw new BadRequestException('推广码至少需要 3 位字母/数字');
    }
    if (!name) {
      throw new BadRequestException('请填写推广员名称');
    }
    const code = requestedCode || (await this.generateUniqueAffiliateCode(name));
    const commissionRate = Math.min(
      Math.max(Number(input.commissionRate ?? 0.3), 0),
      0.8,
    );
    const attributionDays = Math.min(
      Math.max(Number(input.attributionDays ?? 30), 1),
      365,
    );
    const recurringDays = Math.min(
      Math.max(Number(input.recurringDays ?? 180), 1),
      730,
    );
    const parentPartnerId = String(input.parentPartnerId || '').trim() || null;
    const overrideCommissionRate = Math.min(
      Math.max(Number(input.overrideCommissionRate ?? 0.05), 0),
      0.5,
    );
    if (parentPartnerId) {
      const parent = await this.prisma.affiliatePartner.findUnique({
        where: { id: parentPartnerId },
        select: { id: true, isActive: true },
      });
      if (!parent?.isActive) {
        throw new BadRequestException('上级代理不存在或已停用');
      }
    }
    const settlementCycle =
      input.settlementCycle === 'weekly' ? 'weekly' : 'monthly';
    const minimumPayout = Math.min(
      Math.max(Number(input.minimumPayout ?? 50), 0),
      10000,
    );
    const token = this.generateAffiliateToken();
    const partner = await this.prisma.affiliatePartner.create({
      data: {
        code,
        name,
        email: input.email?.trim() || null,
        note: input.note?.trim() || null,
        commissionRate,
        attributionDays,
        recurringDays,
        parentPartnerId,
        overrideCommissionRate,
        settlementCycle,
        minimumPayout,
        dashboardTokenHash: this.hashAffiliateToken(token),
      },
    });
    return {
      ...partner,
      dashboardUrl: this.buildAffiliateDashboardUrl(partner.code, token),
    };
  }

  async adminResetAffiliateDashboardToken(id: string) {
    const token = this.generateAffiliateToken();
    const partner = await this.prisma.affiliatePartner.update({
      where: { id },
      data: { dashboardTokenHash: this.hashAffiliateToken(token) },
    });
    return {
      id: partner.id,
      code: partner.code,
      dashboardUrl: this.buildAffiliateDashboardUrl(partner.code, token),
    };
  }

  async adminAffiliateReport(partnerId?: string, days = 30) {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - safeDays * 86400000);
    const partnerWhere = partnerId ? { partnerId } : {};
    const overrideWhere = partnerId ? { parentPartnerId: partnerId } : {};
    const userWhere = partnerId
      ? { affiliatePartnerId: partnerId, createdAt: { gte: since } }
      : { affiliatePartnerId: { not: null }, createdAt: { gte: since } };
    const [partners, newUsers, commissions, commissionAgg, overrideCommissions, overrideAgg] =
      await Promise.all([
        this.prisma.affiliatePartner.findMany({
          where: partnerId ? { id: partnerId } : undefined,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.findMany({
          where: userWhere,
          select: { id: true, email: true, name: true, createdAt: true, affiliatePartnerId: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.affiliateCommission.findMany({
          where: {
            ...partnerWhere,
            createdAt: { gte: since },
          },
          include: {
            partner: { select: { id: true, code: true, name: true } },
            payment: {
              select: {
                id: true,
                product: { select: { code: true, name: true } },
                completedAt: true,
              },
            },
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        this.prisma.affiliateCommission.groupBy({
          by: ['partnerId', 'status'],
          where: {
            ...partnerWhere,
            createdAt: { gte: since },
          },
          _sum: {
            grossAmount: true,
            netAmount: true,
            commissionAmount: true,
          },
          _count: { id: true },
        }),
        this.prisma.affiliateOverrideCommission.findMany({
          where: {
            ...overrideWhere,
            createdAt: { gte: since },
          },
          include: {
            parentPartner: { select: { id: true, code: true, name: true } },
            childPartner: { select: { id: true, code: true, name: true } },
            payment: {
              select: {
                id: true,
                product: { select: { code: true, name: true } },
                completedAt: true,
              },
            },
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        this.prisma.affiliateOverrideCommission.groupBy({
          by: ['parentPartnerId', 'status'],
          where: {
            ...overrideWhere,
            createdAt: { gte: since },
          },
          _sum: {
            grossAmount: true,
            netAmount: true,
            baseCommissionAmount: true,
            overrideAmount: true,
          },
          _count: { id: true },
        }),
      ]);

    return {
      periodDays: safeDays,
      since: since.toISOString(),
      newAffiliateUsers: newUsers.length,
      registeredUsers: newUsers.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        partnerId: user.affiliatePartnerId,
        createdAt: user.createdAt,
      })),
      partners: partners.map((partner) => ({
        id: partner.id,
        code: partner.code,
        name: partner.name,
        commissionRate: partner.commissionRate,
        settlementCycle: partner.settlementCycle,
        minimumPayout: partner.minimumPayout,
        isActive: partner.isActive,
      })),
      summary: commissionAgg.map((row) => ({
        partnerId: row.partnerId,
        status: row.status,
        orderCount: row._count.id,
        grossAmount: Number((row._sum.grossAmount || 0).toFixed(2)),
        netAmount: Number((row._sum.netAmount || 0).toFixed(2)),
        commissionAmount: Number(
          (row._sum.commissionAmount || 0).toFixed(2),
        ),
      })),
      overrideSummary: overrideAgg.map((row) => ({
        parentPartnerId: row.parentPartnerId,
        status: row.status,
        orderCount: row._count.id,
        grossAmount: Number((row._sum.grossAmount || 0).toFixed(2)),
        netAmount: Number((row._sum.netAmount || 0).toFixed(2)),
        baseCommissionAmount: Number((row._sum.baseCommissionAmount || 0).toFixed(2)),
        overrideAmount: Number((row._sum.overrideAmount || 0).toFixed(2)),
      })),
      commissions: commissions.map((row) => ({
        id: row.id,
        partner: row.partner,
        user: row.user,
        paymentId: row.paymentId,
        product: row.payment.product,
        grossAmount: row.grossAmount,
        netAmount: row.netAmount,
        commissionRate: row.commissionRate,
        commissionAmount: row.commissionAmount,
        currency: row.currency,
        status: row.status,
        sourceReferralCode: row.sourceReferralCode,
        completedAt: row.payment.completedAt,
        createdAt: row.createdAt,
      })),
      overrideCommissions: overrideCommissions.map((row) => ({
        id: row.id,
        parentPartner: row.parentPartner,
        childPartner: row.childPartner,
        user: row.user,
        paymentId: row.paymentId,
        product: row.payment.product,
        grossAmount: row.grossAmount,
        netAmount: row.netAmount,
        baseCommissionAmount: row.baseCommissionAmount,
        overrideRate: row.overrideRate,
        overrideAmount: row.overrideAmount,
        currency: row.currency,
        status: row.status,
        sourceReferralCode: row.sourceReferralCode,
        completedAt: row.payment.completedAt,
        createdAt: row.createdAt,
      })),
    };
  }

  async affiliatePortal(codeRaw?: string, token?: string) {
    const code = String(codeRaw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!code || !token) {
      throw new BadRequestException('缺少推广码或访问密钥');
    }

    const partner = await this.prisma.affiliatePartner.findUnique({
      where: { code },
      include: {
        parentPartner: { select: { id: true, code: true, name: true } },
        subPartners: {
          select: { id: true, code: true, name: true, commissionRate: true, overrideCommissionRate: true, isActive: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!partner?.isActive || !partner.dashboardTokenHash) {
      throw new BadRequestException('推广链接不可用，请联系山海灵境');
    }
    const actual = this.hashAffiliateToken(token);
    const expected = partner.dashboardTokenHash;
    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    ) {
      throw new BadRequestException('访问密钥无效');
    }

    const [users, clickCount, commissions, summary, paidUsers, overrideCommissions, overrideSummary] = await Promise.all([
      this.prisma.user.findMany({
        where: { affiliatePartnerId: partner.id },
        select: { id: true, email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.analyticsEvent.count({
        where: {
          name: 'affiliate_landing',
          props: { path: ['ref'], equals: partner.code },
        },
      }),
      this.prisma.affiliateCommission.findMany({
        where: { partnerId: partner.id },
        include: {
          payment: {
            select: {
              product: { select: { name: true, code: true } },
              completedAt: true,
            },
          },
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.affiliateCommission.groupBy({
        by: ['status'],
        where: { partnerId: partner.id },
        _sum: {
          grossAmount: true,
          netAmount: true,
          commissionAmount: true,
        },
        _count: { id: true },
      }),
      this.prisma.affiliateCommission.findMany({
        where: { partnerId: partner.id },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.affiliateOverrideCommission.findMany({
        where: { parentPartnerId: partner.id },
        include: {
          childPartner: { select: { id: true, code: true, name: true } },
          payment: {
            select: {
              product: { select: { name: true, code: true } },
              completedAt: true,
            },
          },
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.affiliateOverrideCommission.groupBy({
        by: ['status'],
        where: { parentPartnerId: partner.id },
        _sum: {
          grossAmount: true,
          netAmount: true,
          baseCommissionAmount: true,
          overrideAmount: true,
        },
        _count: { id: true },
      }),
    ]);

    const paidUserIds = new Set(paidUsers.map((row) => row.userId));
    const byStatus = summary.reduce<Record<string, {
      orderCount: number;
      grossAmount: number;
      netAmount: number;
      commissionAmount: number;
    }>>((acc, row) => {
      acc[row.status] = {
        orderCount: row._count.id,
        grossAmount: Number((row._sum.grossAmount || 0).toFixed(2)),
        netAmount: Number((row._sum.netAmount || 0).toFixed(2)),
        commissionAmount: Number((row._sum.commissionAmount || 0).toFixed(2)),
      };
      return acc;
    }, {});
    const overrideByStatus = overrideSummary.reduce<Record<string, {
      orderCount: number;
      grossAmount: number;
      netAmount: number;
      baseCommissionAmount: number;
      overrideAmount: number;
    }>>((acc, row) => {
      acc[row.status] = {
        orderCount: row._count.id,
        grossAmount: Number((row._sum.grossAmount || 0).toFixed(2)),
        netAmount: Number((row._sum.netAmount || 0).toFixed(2)),
        baseCommissionAmount: Number((row._sum.baseCommissionAmount || 0).toFixed(2)),
        overrideAmount: Number((row._sum.overrideAmount || 0).toFixed(2)),
      };
      return acc;
    }, {});

    return {
      partner: {
        code: partner.code,
        name: partner.name,
        commissionRate: partner.commissionRate,
        parentPartner: partner.parentPartner,
        overrideCommissionRate: partner.overrideCommissionRate,
        settlementCycle: partner.settlementCycle,
        minimumPayout: partner.minimumPayout,
        nextSettlementAt: this.nextSettlementDate(partner.settlementCycle),
      },
      funnel: {
        clicks: clickCount,
        registeredUsers: users.length,
        paidUsers: paidUserIds.size,
        conversionRate:
          users.length === 0
            ? 0
            : Number((paidUserIds.size / users.length).toFixed(4)),
      },
      summary: {
        pending: byStatus.pending || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          commissionAmount: 0,
        },
        approved: byStatus.approved || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          commissionAmount: 0,
        },
        paid: byStatus.paid || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          commissionAmount: 0,
        },
      },
      overrideSummary: {
        pending: overrideByStatus.pending || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          baseCommissionAmount: 0,
          overrideAmount: 0,
        },
        approved: overrideByStatus.approved || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          baseCommissionAmount: 0,
          overrideAmount: 0,
        },
        paid: overrideByStatus.paid || {
          orderCount: 0,
          grossAmount: 0,
          netAmount: 0,
          baseCommissionAmount: 0,
          overrideAmount: 0,
        },
      },
      subPartners: partner.subPartners,
      commissions: commissions.map((row) => ({
        id: row.id,
        user: row.user,
        productName: row.payment.product.name,
        productCode: row.payment.product.code,
        grossAmount: row.grossAmount,
        netAmount: row.netAmount,
        commissionAmount: row.commissionAmount,
        currency: row.currency,
        status: row.status,
        completedAt: row.payment.completedAt,
        createdAt: row.createdAt,
      })),
      registeredUsers: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        paid: paidUserIds.has(user.id),
      })),
      overrideCommissions: overrideCommissions.map((row) => ({
        id: row.id,
        childPartner: row.childPartner,
        user: row.user,
        productName: row.payment.product.name,
        productCode: row.payment.product.code,
        grossAmount: row.grossAmount,
        netAmount: row.netAmount,
        baseCommissionAmount: row.baseCommissionAmount,
        overrideRate: row.overrideRate,
        overrideAmount: row.overrideAmount,
        currency: row.currency,
        status: row.status,
        completedAt: row.payment.completedAt,
        createdAt: row.createdAt,
      })),
    };
  }
}
