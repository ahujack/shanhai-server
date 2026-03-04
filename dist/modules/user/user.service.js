"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
let UserService = class UserService {
    users = new Map();
    verificationCodes = new Map();
    phoneToUser = new Map();
    emailToUser = new Map();
    socialToUser = new Map();
    CODE_EXPIRE_TIME = 5 * 60 * 1000;
    create(dto) {
        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const user = {
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
    findAll() {
        return Array.from(this.users.values());
    }
    findOne(id) {
        const user = this.users.get(id);
        if (!user) {
            throw new common_1.NotFoundException('用户不存在');
        }
        return user;
    }
    update(id, dto) {
        const user = this.findOne(id);
        const updated = {
            ...user,
            ...dto,
            updatedAt: new Date().toISOString(),
        };
        this.users.set(id, updated);
        return updated;
    }
    delete(id) {
        if (!this.users.has(id)) {
            throw new common_1.NotFoundException('用户不存在');
        }
        this.users.delete(id);
    }
    storeCode(identifier, code) {
        this.verificationCodes.set(identifier, {
            code,
            expiresAt: Date.now() + this.CODE_EXPIRE_TIME,
        });
    }
    verifyCode(identifier, code) {
        const stored = this.verificationCodes.get(identifier);
        if (!stored) {
            return false;
        }
        if (Date.now() > stored.expiresAt) {
            this.verificationCodes.delete(identifier);
            return false;
        }
        if (stored.code === code) {
            this.verificationCodes.delete(identifier);
            return true;
        }
        return false;
    }
    findOrCreateByIdentifier(identifier) {
        let userId = this.phoneToUser.get(identifier) || this.emailToUser.get(identifier);
        if (userId) {
            return this.findOne(userId);
        }
        const isPhone = /^\d{11}$/.test(identifier);
        const user = this.create({
            name: isPhone ? `用户${identifier.slice(-4)}` : identifier.split('@')[0],
        });
        if (isPhone) {
            user.phone = identifier;
            this.phoneToUser.set(identifier, user.id);
        }
        else {
            user.email = identifier;
            this.emailToUser.set(identifier, user.id);
        }
        this.users.set(user.id, user);
        return user;
    }
    findOrCreateBySocial(provider, socialId) {
        const key = `${provider}:${socialId}`;
        let userId = this.socialToUser.get(key);
        if (userId) {
            return this.findOne(userId);
        }
        const user = this.create({
            name: `${provider}用户`,
        });
        this.socialToUser.set(key, user.id);
        user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
        this.users.set(user.id, user);
        return user;
    }
    updateUserRole(userId, role) {
        const user = this.findOne(userId);
        user.role = role;
        user.updatedAt = new Date().toISOString();
        this.users.set(userId, user);
        return user;
    }
    updateUserMembership(userId, membership) {
        const user = this.findOne(userId);
        user.membership = membership;
        user.updatedAt = new Date().toISOString();
        this.users.set(userId, user);
        return user;
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)()
], UserService);
//# sourceMappingURL=user.service.js.map