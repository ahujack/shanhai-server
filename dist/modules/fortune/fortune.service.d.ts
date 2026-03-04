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
}
export declare class FortuneService {
    private lastUserId;
    private lastDate;
    private cachedSlip;
    getDailyFortune(userId?: string): FortuneSlip;
    getSlipByIndex(index: number): FortuneSlip;
    drawRandomSlip(): FortuneSlip;
}
