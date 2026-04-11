import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import { PointsService } from '../points/points.service';
import { AchievementService } from '../achievement/achievement.service';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export interface UserProfile {
  id: string;
  name: string;
  birthDate?: string;
  birthTime?: string;
  calendarType?: 'solar' | 'lunar';
  isLeapMonth?: boolean;
  birthLocation?: string;
  birthLongitude?: number;
  birthLatitude?: number;
  gender?: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
  focusGod?: string;
  phone?: string;
  email?: string;
  password?: string;
  avatar?: string;
  role: 'user' | 'admin';
  membership: 'free' | 'premium' | 'vip';
  /** 会员到期时间；未设置时后端仍按 VIP 权益处理（兼容历史数据） */
  membershipExpiryAt?: Date | null;
  googleId?: string;
  facebookId?: string;
  referralCode?: string; // 推荐码
  referredBy?: string;   // 推荐人ID
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  name: string;
  email?: string;
  birthDate?: string;
  birthTime?: string;
  calendarType?: 'solar' | 'lunar';
  isLeapMonth?: boolean;
  birthLocation?: string;
  birthLongitude?: number;
  birthLatitude?: number;
  gender?: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
  focusGod?: string;
}

interface VerificationCode {
  code: string;
  expiresAt: number;
}
type VerificationCodePurpose = 'login' | 'register' | 'reset';
type VerifyCodeFailReason = 'not_found' | 'expired' | 'mismatch' | 'locked';
export interface VerifyCodeResult {
  ok: boolean;
  reason?: VerifyCodeFailReason;
  retryAfterSec?: number;
}

@Injectable()
export class UserService {
  private verificationCodes: Map<string, VerificationCode> = new Map();
  private lastVerificationCleanupAt = 0;

  // 中国传统特色头像 - 使用Emoji作为头像
  private readonly traditionalAvatars = [
    '🐲', '🦊', '🐉', '🐺', '🦁', '🐻',
    '🐯', '🦅', '🦄', '🐢', '🦉', '🦋',
    '🐍', '🐉', '🦄', '🐢', '🦅', '🦉',
    '⚜️', '🧿', '🔮', '🕯️', '📿', '🏮',
    '🌙', '⭐', '☯️', '🎋', '🎏', '🧧',
    '🐉', '🦁', '🐯', '🦅', '🐺', '🦊',
    '🐍', '🐢', '🦄', '🐉', '🦅', '🦉',
  ];

  // 默认昵称：国风随机名（仅在用户未主动填写昵称时使用）
  private readonly culturalSurnamePool = [
    '云', '玄', '青', '洛', '长', '沐', '闻', '司', '顾', '沈',
    '谢', '裴', '苏', '白', '花', '柳', '宋', '宁', '温', '叶',
  ];
  private readonly culturalGivenPool = [
    '清', '遥', '岚', '川', '月', '星', '舟', '霁', '澜', '汐',
    '霄', '言', '尘', '栖', '禾', '灵', '弦', '棠', '竹', '衡',
  ];
  private readonly culturalSuffixPool = [
    '子', '君', '客', '生', '卿', '人', '师', '者', '舟', '吟',
  ];

  // 验证码有效期：5分钟
  private readonly CODE_EXPIRE_TIME = 5 * 60 * 1000;
  // 过期验证码清理节流（避免每次发码都全表 deleteMany）
  private readonly VERIFICATION_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  private readonly VERIFICATION_MAX_FAILED_ATTEMPTS = 5;
  private readonly VERIFICATION_LOCK_MS = 10 * 60 * 1000;

  // 密码哈希轮数
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private prisma: PrismaService,
    private mailService?: MailService,
    @Inject(forwardRef(() => PointsService))
    private pointsService?: PointsService,
    @Inject(forwardRef(() => AchievementService))
    private achievementService?: AchievementService,
  ) {}

  // 哈希密码（使用 bcrypt）
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  // 验证密码
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // 检查邮箱是否已注册
  async isEmailRegistered(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  // 注册新用户（需要验证码验证）
  async registerWithEmail(email: string, password: string, name?: string, referralCode?: string): Promise<UserProfile> {
    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('该邮箱已注册');
    }

    // 生成随机推荐码
    const userReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    // 处理推荐关系
    let referredBy: string | null = null;
    if (referralCode) {
      // 查找推荐人
      const referrer = await this.prisma.user.findFirst({
        where: { referralCode },
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: this.resolveDisplayName(name),
        password: await this.hashPassword(password),
        avatar: this.getRandomAvatar(), // 随机分配中国传统特色头像
        timezone: 'Asia/Shanghai',
        role: 'user',
        membership: 'free',
        referralCode: userReferralCode,
        referredBy,
      },
    });

    // 处理推荐奖励
    if (referredBy) {
      try {
        // 给新用户50积分
        if (this.pointsService) {
          await this.pointsService.awardPoints(user.id, 50, 'referral_bonus', '新用户注册奖励');
          // 给推荐人50积分
          await this.pointsService.awardPoints(referredBy, 50, 'referral_reward', '推荐好友奖励');
        }
        // 解锁成就
        if (this.achievementService) {
          await this.achievementService.unlockAchievementByCode(user.id, 'login_1');
          await this.achievementService.unlockAchievementByCode(referredBy, 'invite_1');
        }
      } catch (e) {
        console.error('推荐奖励发放失败:', e);
      }
    } else {
      // 新用户首次注册奖励
      try {
        if (this.pointsService) {
          await this.pointsService.awardPoints(user.id, 20, 'register_bonus', '新用户注册奖励');
        }
        if (this.achievementService) {
          await this.achievementService.unlockAchievementByCode(user.id, 'login_1');
        }
      } catch (e) {
        console.error('注册奖励发放失败:', e);
      }
    }

    return this.formatUser(user);
  }

  // 使用邮箱密码登录
  async loginWithPassword(email: string, password: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      return null;
    }

    return this.formatUser(user);
  }

  // 重置密码
  async resetPassword(email: string, newPassword: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: {
        password: await this.hashPassword(newPassword),
      },
    });

    return this.formatUser(updatedUser);
  }

  /** 占位/无效邮箱（历史数据或误创建） */
  private isPlaceholderEmail(email?: string | null): boolean {
    if (!email?.trim()) return true;
    if (email.endsWith('@example.com')) return true;
    if (/@google\.oauth\.pending$/i.test(email)) return true;
    return false;
  }

  // 创建用户（游客完善资料也必须提供真实邮箱，避免再出现数字@example.com）
  async create(dto: CreateUserDto): Promise<UserProfile> {
    const email = dto.email?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('请填写有效邮箱后再保存资料');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        birthDate: dto.birthDate,
        birthTime: dto.birthTime,
        calendarType: dto.calendarType || 'solar',
        isLeapMonth: dto.isLeapMonth || false,
        birthLocation: dto.birthLocation,
        birthLongitude: dto.birthLongitude,
        birthLatitude: dto.birthLatitude,
        gender: dto.gender,
        timezone: dto.timezone ?? 'Asia/Shanghai',
        location: dto.location,
        role: 'user',
        membership: 'free',
      } as any,
    });

    return this.formatUser(user);
  }

  /** 仅管理员可调用；由 Controller 守卫保证 */
  async requireAdmin(userId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (u?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
  }

  // 获取所有用户
  async findAll(): Promise<UserProfile[]> {
    const users = await this.prisma.user.findMany();
    return users.map(this.formatUser);
  }

  // 获取单个用户
  async findOne(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.formatUser(user);
  }

  // 更新用户（过滤 undefined，确保 Prisma 正确更新）
  async update(id: string, dto: Partial<CreateUserDto>): Promise<UserProfile> {
    const clean = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined)
    ) as Partial<CreateUserDto>;
    if (clean.email !== undefined) {
      const em = typeof clean.email === 'string' ? clean.email.trim() : '';
      if (!em) {
        delete clean.email;
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          throw new BadRequestException('邮箱格式不正确');
        }
        clean.email = em;
        const existing = await this.prisma.user.findFirst({
          where: { email: clean.email, id: { not: id } },
        });
        if (existing) {
          throw new BadRequestException('该邮箱已被其他账号使用');
        }
      }
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...clean,
        updatedAt: new Date(),
      } as any,
    });

    return this.formatUser(user);
  }

  // 删除用户
  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  // 获取随机中国传统特色头像
  private getRandomAvatar(): string {
    const index = Math.floor(Math.random() * this.traditionalAvatars.length);
    return this.traditionalAvatars[index];
  }

  private resolveDisplayName(name?: string): string {
    const normalized = (name || '').trim();
    if (normalized) {
      return normalized.slice(0, 20);
    }
    return this.getRandomCulturalName();
  }

  private getRandomCulturalName(): string {
    const surname = this.culturalSurnamePool[Math.floor(Math.random() * this.culturalSurnamePool.length)];
    const givenA = this.culturalGivenPool[Math.floor(Math.random() * this.culturalGivenPool.length)];
    const givenB = this.culturalGivenPool[Math.floor(Math.random() * this.culturalGivenPool.length)];
    const suffix = this.culturalSuffixPool[Math.floor(Math.random() * this.culturalSuffixPool.length)];
    return `${surname}${givenA}${givenB}${suffix}`;
  }

  private normalizeVerificationIdentifier(identifier: string): string {
    return String(identifier || '').trim().toLowerCase();
  }

  private buildVerificationKey(identifier: string, purpose: VerificationCodePurpose): string {
    return `${identifier}::${purpose}`;
  }

  private async cleanupExpiredVerificationCodesIfNeeded(nowMs = Date.now()): Promise<void> {
    if (nowMs - this.lastVerificationCleanupAt < this.VERIFICATION_CLEANUP_INTERVAL_MS) return;
    this.lastVerificationCleanupAt = nowMs;
    await this.prisma.verificationCode
      .deleteMany({ where: { expiresAt: { lt: new Date(nowMs) } } })
      .catch(() => null);
  }

  // 存储验证码
  async storeCode(identifier: string, code: string, purpose: VerificationCodePurpose = 'login'): Promise<void> {
    const normalizedIdentifier = this.normalizeVerificationIdentifier(identifier);
    const key = this.buildVerificationKey(normalizedIdentifier, purpose);
    this.verificationCodes.set(key, {
      code,
      expiresAt: Date.now() + this.CODE_EXPIRE_TIME,
    });
    try {
      const expiresAt = new Date(Date.now() + this.CODE_EXPIRE_TIME);
      await this.prisma.verificationCode.upsert({
        where: {
          identifier_purpose: {
            identifier: normalizedIdentifier,
            purpose,
          },
        },
        create: {
          identifier: normalizedIdentifier,
          purpose,
          code,
          expiresAt,
          failedAttempts: 0,
          lockedUntil: null,
        },
        update: {
          code,
          expiresAt,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.cleanupExpiredVerificationCodesIfNeeded();
    } catch (error) {
      console.error('验证码持久化失败，已回退内存存储:', error);
    }
  }

  // 验证验证码
  async verifyCode(identifier: string, code: string, purpose: VerificationCodePurpose = 'login'): Promise<VerifyCodeResult> {
    const nowMs = Date.now();
    const normalizedIdentifier = this.normalizeVerificationIdentifier(identifier);
    const key = this.buildVerificationKey(normalizedIdentifier, purpose);
    let stored = this.verificationCodes.get(key);
    let persistedRow: {
      code: string;
      expiresAt: Date;
      failedAttempts: number;
      lockedUntil: Date | null;
    } | null = null;
    try {
      const persisted = await this.prisma.verificationCode.findUnique({
        where: {
          identifier_purpose: {
            identifier: normalizedIdentifier,
            purpose,
          },
        },
      });
      if (persisted) {
        persistedRow = {
          code: persisted.code,
          expiresAt: persisted.expiresAt,
          failedAttempts: persisted.failedAttempts || 0,
          lockedUntil: persisted.lockedUntil || null,
        };
        stored = {
          code: persisted.code,
          expiresAt: persisted.expiresAt.getTime(),
        };
        this.verificationCodes.set(key, stored);
      }
    } catch (error) {
      console.error('读取验证码持久化记录失败，回退内存校验:', error);
    }

    if (!stored) {
      return { ok: false, reason: 'not_found' };
    }

    const lockedUntilMs = persistedRow?.lockedUntil ? persistedRow.lockedUntil.getTime() : 0;
    if (lockedUntilMs > nowMs) {
      const retryAfterSec = Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000));
      return { ok: false, reason: 'locked', retryAfterSec };
    }

    // 检查是否过期
    if (nowMs > stored.expiresAt) {
      this.verificationCodes.delete(key);
      await this.prisma.verificationCode
        .deleteMany({
          where: { identifier: normalizedIdentifier, purpose },
        })
        .catch(() => null);
      return { ok: false, reason: 'expired' };
    }

    // 验证成功，删除验证码
    if (stored.code === code) {
      this.verificationCodes.delete(key);
      await this.prisma.verificationCode
        .deleteMany({
          where: { identifier: normalizedIdentifier, purpose },
        })
        .catch(() => null);
      return { ok: true };
    }

    const nextFailedAttempts = (persistedRow?.failedAttempts || 0) + 1;
    const shouldLock = nextFailedAttempts >= this.VERIFICATION_MAX_FAILED_ATTEMPTS;
    const lockUntil = shouldLock ? new Date(nowMs + this.VERIFICATION_LOCK_MS) : null;
    await this.prisma.verificationCode
      .updateMany({
        where: { identifier: normalizedIdentifier, purpose },
        data: {
          failedAttempts: nextFailedAttempts,
          lockedUntil: lockUntil,
        },
      })
      .catch(() => null);
    return shouldLock
      ? {
          ok: false,
          reason: 'locked',
          retryAfterSec: Math.ceil(this.VERIFICATION_LOCK_MS / 1000),
        }
      : { ok: false, reason: 'mismatch' };
  }

  // 通过邮箱查找或创建用户
  async findOrCreateByEmail(email: string): Promise<UserProfile> {
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: this.getRandomCulturalName(),
          timezone: 'Asia/Shanghai',
          role: 'user',
          membership: 'free',
        },
      });
    }

    return this.formatUser(user);
  }

  // 第三方登录 - 查找或创建用户（googleId/facebookId 使用稳定 sub/id；legacyOAuthToken 匹配历史误存整段 token 的记录）
  async findOrCreateBySocial(
    provider: 'google' | 'facebook',
    socialId: string,
    userInfo?: { email?: string; name?: string },
    legacyOAuthToken?: string,
  ): Promise<UserProfile> {
    if (!socialId?.trim()) {
      throw new BadRequestException('第三方账号标识无效');
    }

    const legacy = legacyOAuthToken?.trim();

    // 1) 同一邮箱只保留一条用户：第三方返回的真实邮箱与已注册账号合并
    if (userInfo?.email?.trim()) {
      const normalizedEmail = userInfo.email.trim();
      const byEmail = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (byEmail) {
        const data: Prisma.UserUpdateInput = {};
        if (provider === 'google') data.googleId = socialId;
        if (provider === 'facebook') data.facebookId = socialId;
        if (userInfo.name && (byEmail.name.includes('用户') || byEmail.name === byEmail.email.split('@')[0])) {
          data.name = userInfo.name;
        }
        if (Object.keys(data).length > 0) {
          const updated = await this.prisma.user.update({
            where: { id: byEmail.id },
            data,
          });
          return this.formatUser(updated);
        }
        return this.formatUser(byEmail);
      }
    }

    const idWhere =
      provider === 'google'
        ? { OR: [{ googleId: socialId }, ...(legacy ? [{ googleId: legacy }] : [])] }
        : { OR: [{ facebookId: socialId }, ...(legacy ? [{ facebookId: legacy }] : [])] };

    let user = await this.prisma.user.findFirst({ where: idWhere });

    if (user) {
      if (userInfo) {
        const updateData: Prisma.UserUpdateInput = {};
        if (provider === 'google' && user.googleId !== socialId) {
          updateData.googleId = socialId;
        }
        if (provider === 'facebook' && user.facebookId !== socialId) {
          updateData.facebookId = socialId;
        }
        if (userInfo.email?.trim()) {
          const em = userInfo.email.trim();
          if (this.isPlaceholderEmail(user.email)) {
            const taken = await this.prisma.user.findFirst({
              where: { email: em, id: { not: user.id } },
            });
            if (!taken) updateData.email = em;
          }
        }
        if (userInfo.name && (user.name?.includes('用户') || !user.name?.trim())) {
          updateData.name = userInfo.name;
        }
        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }
      }
      return this.formatUser(user);
    }

    const emailForCreate = userInfo?.email?.trim();
    if (!emailForCreate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForCreate)) {
      throw new BadRequestException('无法获取第三方账号邮箱，请在授权时勾选邮箱权限或稍后重试');
    }

    const data: Prisma.UserCreateInput = {
      email: emailForCreate,
      name: userInfo?.name?.trim() || emailForCreate.split('@')[0],
      avatar: this.getRandomAvatar(),
      timezone: 'Asia/Shanghai',
      role: 'user',
      membership: 'free',
    };

    if (provider === 'google') {
      data.googleId = socialId;
    } else {
      data.facebookId = socialId;
    }

    user = await this.prisma.user.create({ data });
    return this.formatUser(user);
  }

  // 更新用户角色（管理员功能）
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return this.formatUser(user);
  }

  // 更新用户会员等级（管理员功能）
  async updateUserMembership(userId: string, membership: 'free' | 'premium' | 'vip'): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { membership },
    });

    return this.formatUser(user);
  }

  // 管理员手动发积分（用于补偿、活动或测试）
  async adminGrantPoints(
    operatorId: string,
    userId: string,
    points: number,
    reason?: string,
  ): Promise<{ user: UserProfile; points: { totalPoints: number; availablePoints: number } }> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException('目标用户不存在');
    }
    const safeReason = reason?.trim().slice(0, 200) || '管理员手动发放';

    await this.prisma.$transaction(async (tx) => {
      await tx.userPoints.upsert({
        where: { userId },
        create: {
          userId,
          totalPoints: points,
          availablePoints: points,
        },
        update: {
          totalPoints: { increment: points },
          availablePoints: { increment: points },
        },
      });
      await tx.pointRecord.create({
        data: {
          userId,
          points,
          type: 'bonus',
          description: `${safeReason}（admin:${operatorId}）`,
        },
      });
      await tx.analyticsEvent.create({
        data: {
          userId,
          name: 'admin_grant_points',
          props: {
            operatorId,
            points,
            reason: safeReason,
          },
        },
      });
    });

    const [updatedUser, summary] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userPoints.findUnique({ where: { userId } }),
    ]);
    if (!updatedUser || !summary) {
      throw new NotFoundException('积分发放后读取用户信息失败');
    }
    return {
      user: this.formatUser(updatedUser),
      points: {
        totalPoints: summary.totalPoints,
        availablePoints: summary.availablePoints,
      },
    };
  }

  // 管理员手动开通/调整会员
  async adminGrantMembership(
    operatorId: string,
    userId: string,
    membership: 'free' | 'premium' | 'vip',
    days = 30,
    reason?: string,
  ): Promise<UserProfile> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, membershipExpiryAt: true },
    });
    if (!target) {
      throw new NotFoundException('目标用户不存在');
    }

    const now = new Date();
    const safeReason = reason?.trim().slice(0, 200) || '管理员手动调整会员';
    const safeDays = Math.max(1, Math.min(days, 3650));

    let membershipExpiryAt: Date | null = null;
    if (membership !== 'free') {
      const base =
        target.membershipExpiryAt && target.membershipExpiryAt > now
          ? target.membershipExpiryAt
          : now;
      membershipExpiryAt = new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        membership,
        membershipExpiryAt,
      },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        userId,
        name: 'admin_grant_membership',
        props: {
          operatorId,
          membership,
          days: membership === 'free' ? 0 : safeDays,
          reason: safeReason,
          expiresAt: membershipExpiryAt ? membershipExpiryAt.toISOString() : null,
        },
      },
    });

    return this.formatUser(updated);
  }

  // 格式化用户数据（移除敏感信息）
  private formatUser(user: any): UserProfile {
    const { password, ...result } = user;
    return {
      ...result,
      role: user.role as 'user' | 'admin',
      membership: user.membership as 'free' | 'premium' | 'vip',
      gender: user.gender as 'male' | 'female' | 'other' | undefined,
    };
  }
}
