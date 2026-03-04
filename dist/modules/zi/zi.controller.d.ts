import { ZiService, HandwritingAnalysis } from './zi.service';
import { OcrService } from '../ocr/ocr.service';
export declare class AnalyzeZiDto {
    zi: string;
    handwriting?: Partial<HandwritingAnalysis>;
}
export declare class ZiController {
    private readonly ziService;
    private readonly ocrService;
    constructor(ziService: ZiService, ocrService: OcrService);
    analyze(dto: AnalyzeZiDto): Promise<import("./zi.service").ZiResult>;
    recognize(dto: {
        image: string;
    }): Promise<{
        zi: string;
        confidence: number;
    }>;
    analyzeHandwriting(dto: {
        image: string;
    }): Promise<{
        recognizedZi: string;
        confidence: number;
        analysis: import("./zi.service").ZiResult;
        error?: undefined;
    } | {
        recognizedZi: null;
        confidence: number;
        error: string;
        analysis?: undefined;
    }>;
}
