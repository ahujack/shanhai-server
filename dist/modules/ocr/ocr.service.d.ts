export declare class OcrService {
    private readonly logger;
    private readonly API_KEY;
    private readonly API_URL;
    recognizeHandwriting(imageBase64: string): Promise<{
        zi: string;
        confidence: number;
    }>;
    recognizeFromUrl(imageUrl: string): Promise<{
        zi: string;
        confidence: number;
    }>;
}
