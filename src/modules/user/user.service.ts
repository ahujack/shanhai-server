import { Injectable, NotFoundException } from '@nestjs/common';

export interface UserProfile {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: 'male' | 'female' | 'other';
  timezone: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female' | 'other';
  timezone?: string;
  location?: string;
}

@Injectable()
export class UserService {
  // 内存存储，生产环境应连接数据库
  private users: Map<string, UserProfile> = new Map();

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
}
