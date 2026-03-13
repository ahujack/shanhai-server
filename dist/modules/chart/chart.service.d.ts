import { PrismaService } from '../../prisma.service';
type MembershipTier = 'free' | 'premium' | 'vip';
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
    detailedReading: {
        corePattern: string;
        relationship: string;
        career: string;
        wealth: string;
        health: string;
        decadeRhythm: string[];
        luckCycles: {
            startAge: number;
            direction: 'forward' | 'backward';
            cycles: Array<{
                ageRange: string;
                ganZhi: string;
                focus: string;
            }>;
        };
        annualForecast: Array<{
            year: number;
            ganZhi: string;
            tenGod: string;
            hint: string;
            favorable: string;
            caution: string;
            windowMonths: string[];
            masterCommentary?: string;
        }>;
        yearlyTips: string[];
        paywallHint?: string;
        disclaimer: string;
    };
}
export declare class ChartService {
    private prisma;
    private readonly logger;
    private readonly llmCache;
    constructor(prisma: PrismaService);
    private gan;
    private zhi;
    generateChart(userId: string, birthDate: string, birthTime: string, gender: 'male' | 'female', options?: {
        calendarType?: 'solar' | 'lunar';
        isLeapMonth?: boolean;
        birthLongitude?: number;
        timezone?: string;
        membership?: MembershipTier;
    }): Promise<BaziChart>;
    findOne(userId: string, membership?: MembershipTier): Promise<BaziChart | null>;
    private formatChart;
    private calculateYearGanZhi;
    private calculateMonthGanZhi;
    private calculateDayGanZhi;
    private calculateHourGanZhi;
    private resolveSolarDate;
    private applyTrueSolarTimeCorrection;
    private getTimezoneOffsetHours;
    private getSunSign;
    private getMoonSign;
    private calculateWuxingStrength;
    private analyzePersonality;
    private analyzeFortune;
    private generateSuggestions;
    private calculateTenGods;
    private getTenGod;
    private generateConclusion;
    private generateDetailedReading;
    private buildResonanceNarratives;
    private getCurrentLuckCycle;
    private pickTemplateBySeed;
    private buildLuckCycles;
    private buildAnnualForecast;
    private getLuckFocusByTenGod;
    private getAnnualHintByTenGod;
    private getAnnualFavorableByTenGod;
    private getAnnualCautionByTenGod;
    private getAnnualWindowMonthsByTenGod;
    private getGanZhiIndex;
    private getGanZhiByIndex;
    private enhanceDetailedReadingWithLLM;
    private applyMembershipLayer;
    private getMasterCommentary;
    private normalizeLuckPatch;
    private mergeLuckPatch;
    private applyPrecisionAmbiguityStyle;
    private softAmbiguousSentence;
}
export {};
