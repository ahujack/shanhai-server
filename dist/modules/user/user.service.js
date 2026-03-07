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
const prisma_service_1 = require("../../prisma.service");
const mail_service_1 = require("../mail/mail.service");
const bcrypt = __importStar(require("bcryptjs"));
let UserService = class UserService {
    prisma;
    mailService;
    verificationCodes = new Map();
    CODE_EXPIRE_TIME = 5 * 60 * 1000;
    BCRYPT_ROUNDS = 10;
    constructor(prisma, mailService) {
        this.prisma = prisma;
        this.mailService = mailService;
    }
    async hashPassword(password) {
        return bcrypt.hash(password, this.BCRYPT_ROUNDS);
    }
    async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }
    async isEmailRegistered(email) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        return !!user;
    }
    async registerWithEmail(email, password, name) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.BadRequestException('该邮箱已注册');
        }
        const user = await this.prisma.user.create({
            data: {
                email,
                name: name || email.split('@')[0],
                password: await this.hashPassword(password),
                timezone: 'Asia/Shanghai',
                role: 'user',
                membership: 'free',
            },
        });
        return this.formatUser(user);
    }
    async loginWithPassword(email, password) {
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
    async resetPassword(email, newPassword) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.NotFoundException('用户不存在');
        }
        const updatedUser = await this.prisma.user.update({
            where: { email },
            data: {
                password: await this.hashPassword(newPassword),
            },
        });
        return this.formatUser(updatedUser);
    }
    async create(dto) {
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
    async findAll() {
        const users = await this.prisma.user.findMany();
        return users.map(this.formatUser);
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new common_1.NotFoundException('用户不存在');
        }
        return this.formatUser(user);
    }
    async update(id, dto) {
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                ...dto,
                updatedAt: new Date(),
            },
        });
        return this.formatUser(user);
    }
    async delete(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new common_1.NotFoundException('用户不存在');
        }
        await this.prisma.user.delete({
            where: { id },
        });
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
    async findOrCreateByEmail(email) {
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
    async findOrCreateBySocial(provider, socialId, userInfo) {
        const where = provider === 'google'
            ? { googleId: socialId }
            : { facebookId: socialId };
        let user = await this.prisma.user.findFirst({
            where,
        });
        if (user) {
            if (userInfo) {
                const updateData = {};
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
        const data = {
            email: userInfo?.email || `${socialId}@${provider}.com`,
            name: userInfo?.name || `${provider}用户`,
            timezone: 'Asia/Shanghai',
            role: 'user',
            membership: 'free',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo?.name || provider)}&background=random`,
        };
        if (provider === 'google') {
            data.googleId = socialId;
        }
        else {
            data.facebookId = socialId;
        }
        user = await this.prisma.user.create({
            data,
        });
        return this.formatUser(user);
    }
    async updateUserRole(userId, role) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { role },
        });
        return this.formatUser(user);
    }
    async updateUserMembership(userId, membership) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { membership },
        });
        return this.formatUser(user);
    }
    formatUser(user) {
        const { password, ...result } = user;
        return {
            ...result,
            role: user.role,
            membership: user.membership,
            gender: user.gender,
        };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mail_service_1.MailService])
], UserService);
//# sourceMappingURL=user.service.js.map