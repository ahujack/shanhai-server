import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

export interface UserProfile {
  id: string;
  name: string;
  birthDate?: string;
  birthTime?: string;
  gender?: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  role: 'user' | 'admin';
  membership: 'free' | 'premium' | 'vip';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email?: string;
  birthDate?: string;
  birthTime?: string;
  gender?: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
}

interface VerificationCode {
  code: string;
  expiresAt: number;
}

@Injectable()
export class UserService {
  // 内存存储，生产环境应连接数据库
  private users: Map<string, UserProfile> = new Map();
  private verificationCodes: Map<string, VerificationCode> = new Map();
  private emailToUser: Map<string, string> = new Map();
  private socialToUser: Map<string, string> = new Map();

  // 验证码有效期：5分钟
  private readonly CODE_EXPIRE_TIME = 5 * 60 * 1000;

  constructor(private mailService?: MailService) {}

  create(dto: CreateUserDto): UserProfile {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const user: UserProfile = {
      id,
      name: dto.name,
      birthDate: dto.birthDate,
      birthTime: dto.birthTime,
      gender: dto.gender,
      timezone: dto.timezone ?? 'Asia/Shanghai',
      location: dto.location,
      role: 'user',
      membership: 'free',
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    return user;
  }

  findAll(): UserProfile[] {
    return Array.from(this.users.values());
  }

  findOne(id: string): UserProfile {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  update(id: string, dto: Partial<CreateUserDto>): UserProfile {
    const user = this.findOne(id);
    const updated: UserProfile = {
      ...user,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.users.has(id)) {
      throw new NotFoundException('用户不存在');
    }
    this.users.delete(id);
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
  findOrCreateByEmail(email: string): UserProfile {
    // 检查是否已存在
    const userId = this.emailToUser.get(email);
    
    if (userId) {
      return this.findOne(userId);
    }
    
    // 创建新用户
    const user = this.create({
      name: email.split('@')[0],
      email: email,
    });
    
    // 绑定邮箱
    this.emailToUser.set(email, user.id);
    
    this.users.set(user.id, user);
    return user;
  }

  // 第三方登录
  findOrCreateBySocial(provider: 'google' | 'facebook', socialId: string, userInfo?: { email?: string; name?: string }): UserProfile {
    const key = `${provider}:${socialId}`;
    
    // 检查是否已存在
    let userId = this.socialToUser.get(key);
    if (userId) {
      const user = this.findOne(userId);
      // 如果有新的用户信息，更新一下
      if (userInfo) {
        if (userInfo.email && !user.email) {
          user.email = userInfo.email;
          this.emailToUser.set(userInfo.email, user.id);
        }
        if (userInfo.name && user.name === `${provider}用户`) {
          user.name = userInfo.name;
        }
        this.users.set(user.id, user);
      }
      return user;
    }
    
    // 创建新用户
    const user = this.create({
      name: userInfo?.name || `${provider}用户`,
      email: userInfo?.email,
    });
    
    // 绑定社交账号
    this.socialToUser.set(key, user.id);
    user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
    
    this.users.set(user.id, user);
    return user;
  }

  // 更新用户角色（管理员功能）
  updateUserRole(userId: string, role: 'user' | 'admin'): UserProfile {
    const user = this.findOne(userId);
    user.role = role;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    return user;
  }

  // 更新用户会员等级（管理员功能）
  updateUserMembership(userId: string, membership: 'free' | 'premium' | 'vip'): UserProfile {
    const user = this.findOne(userId);
    user.membership = membership;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    return user;
  }
}
