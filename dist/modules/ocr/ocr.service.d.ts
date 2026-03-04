export declare class OcrService {
    private readonly logger;
    private readonly API_KEY;
    private readonly API_URL;
    private readonly MODEL;
    recognizeHandwriting(imageBase64: string): Promise<{
        zi: string;
        confidence: number;
        analysis?: any;
    }>;
    analyzeHandwriting(imageBase64: string, userContext?: {
        age?: number;
        gender?: string;
    }): Promise<any>;
}
