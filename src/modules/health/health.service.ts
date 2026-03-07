import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private startTime: number;

  constructor(private prisma: PrismaService) {
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
    
    // 检查数据库连接
    let dbStatus = 'disconnected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
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

  private formatUptime(seconds: number): string {
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
}
