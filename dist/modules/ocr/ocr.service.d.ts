export declare class OcrService {
    private readonly logger;
    private readonly API_KEY;
    private readonly OCR_API_URL;
    recognizeHandwriting(imageBase64: string): Promise<{
        zi: string;
        confidence: number;
        analysis?: any;
    }>;
}
