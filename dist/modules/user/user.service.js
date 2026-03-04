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
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)()
], UserService);
//# sourceMappingURL=user.service.js.map