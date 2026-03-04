export declare class OcrService {
    private readonly logger;
    private readonly SAMPLE_DIR;
    constructor();
    recognizeHandwriting(imageBase64: string): Promise<{
        zi: string;
        confidence: number;
    }>;
    private extractFromSvg;
}
