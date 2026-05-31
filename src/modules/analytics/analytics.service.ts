import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
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
}
