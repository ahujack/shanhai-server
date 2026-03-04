import { FortuneService } from './fortune.service';
export declare class FortuneController {
    private readonly fortuneService;
    constructor(fortuneService: FortuneService);
    getDailyFortune(userId?: string): import("./fortune.service").FortuneSlip;
    drawRandom(): import("./fortune.service").FortuneSlip;
    getByIndex(index: number): import("./fortune.service").FortuneSlip;
}
