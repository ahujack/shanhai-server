"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
let HealthService = class HealthService {
    prisma;
    startTime;
    constructor(prisma) {
        this.prisma = prisma;
        this.startTime = Date.now();
    }
    async onModuleInit() {
        console.log('🏥 Health Module 已初始化');
    }
    async onModuleDestroy() {
        console.log('🏥 Health Module 已关闭');
    }
    async status() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        let dbStatus = 'disconnected';
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            dbStatus = 'connected';
        }
        catch (error) {
            dbStatus = 'error';
        }
        return {
            success: true,
            status: dbStatus === 'connected' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: uptime,
                formatted: this.formatUptime(uptime),
            },
            service: '山海灵境 API',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            dependencies: {
                database: dbStatus,
            },
            endpoints: {
                health: '/api/health',
                api: '/api',
            },
        };
    }
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (days > 0) {
            return `${days}天 ${hours}小时`;
        }
        if (hours > 0) {
            return `${hours}小时 ${minutes}分钟`;
        }
        if (minutes > 0) {
            return `${minutes}分钟 ${secs}秒`;
        }
        return `${secs}秒`;
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthService);
//# sourceMappingURL=health.service.js.map