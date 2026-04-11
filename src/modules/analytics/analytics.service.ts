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
  const v = (typeof cf === 'string' ? cf : typeof vc === 'string' ? vc : '') || '';
  const t = v.trim().toUpperCase();
  if (!t || t === 'XX') return null;
  return t.slice(0, 8);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  recordFromRequest(
    req: Request,
    params: { userId: string; name: string; props?: Record<string, unknown> },
  ) {
    return this.prisma.analyticsEvent.create({
      data: {
        userId: params.userId,
        name: params.name,
        props: params.props ? (params.props as Prisma.InputJsonValue) : Prisma.JsonNull,
        ip: extractIp(req),
        country: pickCountry(req),
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 512) || null,
      },
    });
  }

  async ingestFromClient(userId: string | null, dto: TrackEventsDto, req: Request) {
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
        context: dto.context ? (dto.context as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return { success: true };
  }

  async adminOverview(days: number) {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86400000);

    const [eventGroups, intentGroups, feedbackGroups, loginCount, userTotal, usersNew] =
      await Promise.all([
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
      ]);

    const byCountry = await this.prisma.analyticsEvent.groupBy({
      by: ['country'],
      where: {
        createdAt: { gte: since },
        country: { not: null },
      },
      _count: { _all: true },
    });

    return {
      periodDays: days,
      since: since.toISOString(),
      totals: {
        users: userTotal,
        newUsersInPeriod: usersNew,
        loginsInPeriod: loginCount,
      },
      eventsByName: eventGroups.map((g) => ({ name: g.name, count: g._count._all })),
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
        user: f.user ? { id: f.user.id, email: f.user.email, name: f.user.name } : null,
      })),
    };
  }
}
