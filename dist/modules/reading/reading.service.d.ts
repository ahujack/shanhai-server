export type DivinationCategory = 'career' | 'love' | 'wealth' | 'health' | 'growth' | 'general';
export interface DivinationResult {
    id: string;
    question: string;
    category: DivinationCategory;
    hexagram: {
        original: string;
        originalName: string;
        changed: string;
        changedName: string;
        lines: string[];
        yaoDescriptions: string[];
    };
    interpretation: {
        overall: string;
        situation: string;
        guidance: string;
    };
    recommendations: string[];
    timing: {
        suitable: string;
        caution: string;
    };
    culturalSource?: string;
    metadata: {
        generatedAt: string;
        method: string;
    };
}
export declare class ReadingService {
    private hexagrams;
    private yaoMeanings;
    generate(dto: {
        question: string;
        category?: DivinationCategory;
        userId?: string;
    }): Promise<DivinationResult>;
    private generateHexagram;
    private linesToHexagram;
    private getYaoDescription;
    private analyzeSituation;
    private getCaution;
    private generateRecommendations;
}
