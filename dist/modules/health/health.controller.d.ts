import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    check(): {
        ok: boolean;
        timestamp: string;
        service: string;
    };
}
