import { ZiService, HandwritingAnalysis } from './zi.service';
import { OcrService } from '../ocr/ocr.service';
export declare class AnalyzeZiDto {
    zi: string;
    handwriting?: Partial<HandwritingAnalysis>;
}
export declare class RecognizeDto {
    image: string;
}
export declare class AnalyzeHandwritingDto {
    image: string;
}
export declare class ZiController {
    private readonly ziService;
    private readonly ocrService;
    constructor(ziService: ZiService, ocrService: OcrService);
    analyze(dto: AnalyzeZiDto): Promise<import("./zi.service").ZiResult>;
    recognize(dto: RecognizeDto): Promise<{
        recognizedZi: string;
        confidence: number;
    }>;
    analyzeHandwriting(dto: AnalyzeHandwritingDto): Promise<{
        recognizedZi: null;
        error: string;
        confidence?: undefined;
        analysis?: undefined;
    } | {
        recognizedZi: string;
        confidence: number;
        analysis: import("./zi.service").ZiResult;
        error?: undefined;
    }>;
}
