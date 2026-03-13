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
    lihefa: string[];
    tianziGe: string[];
    imageryInference: string;
    probingQuestion: string;
    oracleBone: {
        exists: boolean;
        source: string;
        imageUrls: string[];
        totalImages: number;
        shownImages: number;
        previewLocked: boolean;
        interpretation: string;
        note: string;
    };
}
type MembershipTier = 'free' | 'premium' | 'vip';
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
        focusReading?: {
            focus: string;
            summary: string;
            anchors: string[];
            riskSignals: string[];
            actionPlan: string[];
            llmEnhanced?: boolean;
        };
        premiumHint?: string;
    };
    coldReadings: string[];
    followUpQuestions: string[];
    metadata: {
        method: '测字有术 - AI笔迹与语义分析';
        generatedAt: string;
    };
}
export declare class ZiService {
    private readonly logger;
    private oracleBoneLexicon;
    private oracleBoneLexiconLoading;
    private oracleBoneLexiconLoadedAt;
    private readonly oracleBoneIndexUrl;
    private readonly oracleBoneImageBaseUrl;
    private readonly oracleBoneCacheMs;
    private readonly unlockAllForTest;
    analyze(zi: string, handwritingData?: Partial<HandwritingAnalysis>, membership?: MembershipTier, focusAspect?: string): Promise<ZiResult>;
    private getDefaultResult;
    private analyzeHandwriting;
    private analyzeZi;
    private generateColdReadings;
    private generateInterpretation;
    private generateFollowUpQuestions;
    private getLLMEnhancement;
    private normalizeFocusAspect;
    private applyFocusInterpretation;
    private applyMembershipInterpretation;
    private getFocusAdvice;
    private getFocusFollowUpQuestion;
    private getFocusRiskSignals;
    private getFocusActionPlan;
    private hashSeed;
    private pickBySeed;
    private countBihua;
    private getBushou;
    private inferWuxing;
    private inferJixiong;
    private getYijing;
    private getGuaXiang;
    private breakDown;
    private getComponentMeanings;
    private ensureOracleBoneLexicon;
    private createOracleBoneMap;
    private getOracleFallbackMap;
    private buildOracleBoneInsight;
    private normalizeOracleLookupChars;
    private findOracleImagesByCandidates;
    private buildLihefa;
    private buildTianziGe;
    private buildImageryInference;
    private buildProbingQuestion;
    private getCareerByWuxing;
    private getHealthByWuxing;
    private getXiangxingMeaning;
    private getTianganDizhi;
}
export {};
