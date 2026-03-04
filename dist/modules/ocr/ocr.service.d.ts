export declare class OcrService {
    private readonly logger;
    recognizeHandwriting(imageBase64: string): Promise<{
        zi: string;
        confidence: number;
    }>;
}
