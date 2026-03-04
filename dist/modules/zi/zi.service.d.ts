export interface HandwritingAnalysis {
    pressure: 'heavy' | 'light' | 'medium';
    pressureInterpretation: string;
    stability: 'stable' | 'shaky' | 'average';
    stabilityInterpretation: string;
    structure: 'compact' | 'loose' | 'balanced';
    structureInterpretation: string;
    continuity: 'connected' | 'broken' | 'average';
    continuityInterpretation: string;
    overallStyle: string;
    personalityInsights: string[];
}
export interface ZiAnalysis {
    zi: string;
    bushou: string;
    bihua: number;
    wuxing: string;
    yinyang: string;
    jixiong: string;
    yijing: string;
    guaXiang: string;
    components: string[];
    componentMeanings: string[];
    associativeMeaning: string;
}
export interface ZiResult {
    handwriting: HandwritingAnalysis;
    zi: ZiAnalysis;
    interpretation: {
        overall: string;
        career: string;
        love: string;
        wealth: string;
        health: string;
        advice: string[];
    };
    coldReadings: string[];
    followUpQuestions: string[];
    metadata: {
        method: '测字有术 - AI笔迹与语义分析';
        generatedAt: string;
    };
}
export declare class ZiService {
    private logger;
    analyze(zi: string, handwritingData?: Partial<HandwritingAnalysis>): Promise<ZiResult>;
    private analyzeHandwriting;
    private analyzeZi;
    private generateColdReadings;
    private generateInterpretation;
    private generateFollowUpQuestions;
    private getLLMEnhancement;
    private countBihua;
    private getBushou;
    private inferWuxing;
    private inferJixiong;
    private getYijing;
    private getGuaXiang;
    private breakDown;
    private getComponentMeanings;
    private getCareerByWuxing;
    private getHealthByWuxing;
}
