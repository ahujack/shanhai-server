import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    check(): Promise<{
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
}
