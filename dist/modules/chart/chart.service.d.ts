import { PrismaService } from '../../prisma.service';
export interface BaziChart {
    userId: string;
    birthDate: string;
    birthTime: string;
    gender: 'male' | 'female';
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    hourGanZhi: string;
    dayMaster: string;
    tenGods: {
        year: string;
        month: string;
        day: string;
        hour: string;
        summary: string[];
    };
    sun: string;
    moon: string;
    wuxingStrength: {
        wood: number;
        fire: number;
        earth: number;
        metal: number;
        water: number;
    };
    personalityTraits: string[];
    fortuneSummary: {
        career: string;
        wealth: string;
        love: string;
        health: string;
    };
    suggestions: string[];
    conclusion: {
        overall: string;
        mindset: string;
    };
}
export declare class ChartService {
    private prisma;
    constructor(prisma: PrismaService);
    private gan;
    private zhi;
    generateChart(userId: string, birthDate: string, birthTime: string, gender: 'male' | 'female'): Promise<BaziChart>;
    findOne(userId: string): Promise<BaziChart | null>;
    private formatChart;
    private calculateYearGanZhi;
    private calculateMonthGanZhi;
    private calculateDayGanZhi;
    private calculateHourGanZhi;
    private getSunSign;
    private getMoonSign;
    private calculateWuxingStrength;
    private analyzePersonality;
    private analyzeFortune;
    private generateSuggestions;
    private calculateTenGods;
    private getTenGod;
    private generateConclusion;
}
