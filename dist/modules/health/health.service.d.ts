import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
export declare class HealthService implements OnModuleInit, OnModuleDestroy {
    private prisma;
    private startTime;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    status(): Promise<{
        success: boolean;
        status: string;
        timestamp: string;
        uptime: {
            seconds: number;
            formatted: string;
        };
        service: string;
        version: string;
        environment: string;
        dependencies: {
            database: string;
        };
        endpoints: {
            health: string;
            api: string;
        };
    }>;
    private formatUptime;
}
