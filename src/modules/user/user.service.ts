import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
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
  gender?: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
  focusGod?: string;
}

interface VerificationCode {
  code: string;
  expiresAt: number;
}

@Injectable()
export class UserService {
  private verificationCodes: Map<string, VerificationCode> = new Map();

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

  // 验证码有效期：5分钟
  private readonly CODE_EXPIRE_TIME = 5 * 60 * 1000;

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
  async registerWithEmail(email: string, password: string, name: string, referralCode?: string): Promise<UserProfile> {
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
        name: name || email.split('@')[0],
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

  // 创建用户
  async create(dto: CreateUserDto): Promise<UserProfile> {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email || `${Date.now()}@example.com`,
        name: dto.name,
        birthDate: dto.birthDate,
        birthTime: dto.birthTime,
        gender: dto.gender,
        timezone: dto.timezone ?? 'Asia/Shanghai',
        location: dto.location,
        role: 'user',
        membership: 'free',
      },
    });

    return this.formatUser(user);
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

  // 更新用户
  async update(id: string, dto: Partial<CreateUserDto>): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
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

  // 存储验证码
  storeCode(identifier: string, code: string): void {
    this.verificationCodes.set(identifier, {
      code,
      expiresAt: Date.now() + this.CODE_EXPIRE_TIME,
    });
  }

  // 验证验证码
  verifyCode(identifier: string, code: string): boolean {
    const stored = this.verificationCodes.get(identifier);
    if (!stored) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt) {
      this.verificationCodes.delete(identifier);
      return false;
    }

    // 验证成功，删除验证码
    if (stored.code === code) {
      this.verificationCodes.delete(identifier);
      return true;
    }

    return false;
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
          name: email.split('@')[0],
          timezone: 'Asia/Shanghai',
          role: 'user',
          membership: 'free',
        },
      });
    }

    return this.formatUser(user);
  }

  // 第三方登录 - 查找或创建用户
  async findOrCreateBySocial(
    provider: 'google' | 'facebook',
    socialId: string,
    userInfo?: { email?: string; name?: string },
  ): Promise<UserProfile> {
    const where = provider === 'google'
      ? { googleId: socialId }
      : { facebookId: socialId };

    let user = await this.prisma.user.findFirst({
      where,
    });

    if (user) {
      // 如果有新的用户信息，更新一下
      if (userInfo) {
        const updateData: Prisma.UserUpdateInput = {};
        if (userInfo.email && !user.email) {
          updateData.email = userInfo.email;
        }
        if (userInfo.name && user.name.includes('用户')) {
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

    // 创建新用户
    const data: Prisma.UserCreateInput = {
      email: userInfo?.email || `${socialId}@${provider}.com`,
      name: userInfo?.name || `${provider}用户`,
      avatar: this.getRandomAvatar(), // 随机分配中国传统特色头像
      timezone: 'Asia/Shanghai',
      role: 'user',
      membership: 'free',
    };

    if (provider === 'google') {
      data.googleId = socialId;
    } else {
      data.facebookId = socialId;
    }

    user = await this.prisma.user.create({
      data,
    });

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
