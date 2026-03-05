"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const mail_service_1 = require("../mail/mail.service");
const crypto = __importStar(require("crypto"));
let UserService = class UserService {
    mailService;
    users = new Map();
    verificationCodes = new Map();
    emailToUser = new Map();
    socialToUser = new Map();
    CODE_EXPIRE_TIME = 5 * 60 * 1000;
    PASSWORD_SECRET = 'shanhai-password-secret';
    constructor(mailService) {
        this.mailService = mailService;
    }
    hashPassword(password) {
        return crypto.createHmac('sha256', this.PASSWORD_SECRET).update(password).digest('hex');
    }
    verifyPassword(password, hashedPassword) {
        return this.hashPassword(password) === hashedPassword;
    }
    isEmailRegistered(email) {
        return this.emailToUser.has(email);
    }
    registerWithEmail(email, password, name) {
        if (this.emailToUser.has(email)) {
            throw new common_1.BadRequestException('该邮箱已注册');
        }
        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const user = {
            id,
            name: name || email.split('@')[0],
            email,
            password: this.hashPassword(password),
            timezone: 'Asia/Shanghai',
            role: 'user',
            membership: 'free',
            createdAt: now,
            updatedAt: now,
        };
        this.users.set(id, user);
        this.emailToUser.set(email, user.id);
        return user;
    }
    loginWithPassword(email, password) {
        const userId = this.emailToUser.get(email);
        if (!userId) {
            return null;
        }
        const user = this.findOne(userId);
        if (!user.password || !this.verifyPassword(password, user.password)) {
            return null;
        }
        return user;
    }
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
    findOrCreateByEmail(email) {
        const userId = this.emailToUser.get(email);
        if (userId) {
            return this.findOne(userId);
        }
        const user = this.create({
            name: email.split('@')[0],
            email: email,
        });
        this.emailToUser.set(email, user.id);
        this.users.set(user.id, user);
        return user;
    }
    findOrCreateBySocial(provider, socialId, userInfo) {
        const key = `${provider}:${socialId}`;
        let userId = this.socialToUser.get(key);
        if (userId) {
            const user = this.findOne(userId);
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
        const user = this.create({
            name: userInfo?.name || `${provider}用户`,
            email: userInfo?.email,
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
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mail_service_1.MailService])
], UserService);
//# sourceMappingURL=user.service.js.map