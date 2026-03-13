import { PrismaService } from '../../prisma.service';
export interface FortuneSlip {
    id: string;
    zodiac: string;
    zodiacAnimal: string;
    day: string;
    month: string;
    year: string;
    poem: {
        title: string;
        line1: string;
        line2: string;
        line3: string;
        line4: string;
    };
    interpretation: {
        overall: string;
        love: string;
        career: string;
        wealth: string;
        health: string;
    };
    advice: string[];
    lucky: {
        color: string;
        number: string;
        direction: string;
        food: string;
    };
    fortuneRank?: '上上签' | '上签' | '中签' | '下签';
    fortuneScore?: number;
    fortuneTheme?: 'career' | 'love' | 'wealth' | 'health' | 'general';
    luckyTime?: string;
    drawCode?: string;
    funTip?: string;
    mission?: string;
    socialLine?: string;
}
export declare class FortuneService {
    private prisma;
    constructor(prisma: PrismaService);
    private lastUserId;
    private lastDate;
    private cachedSlip;
    private hashString;
    private createRng;
    private pick;
    private inferTheme;
    private scoreFortune;
    private rankFromScore;
    private decorateSlip;
    getDailyFortune(userId?: string): FortuneSlip;
    getSlipByIndex(index: number): FortuneSlip;
    drawRandomSlip(): FortuneSlip;
}
