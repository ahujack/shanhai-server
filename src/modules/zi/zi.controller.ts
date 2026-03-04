import { Body, Controller, Post } from '@nestjs/common';
import { ZiService, HandwritingAnalysis } from './zi.service';
import { OcrService } from '../ocr/ocr.service';

export class AnalyzeZiDto {
  zi: string;
  handwriting?: Partial<HandwritingAnalysis>;
}

export class RecognizeDto {
  image: string; // base64
}

export class AnalyzeHandwritingDto {
  image: string; // base64
}

@Controller('zi')
export class ZiController {
  constructor(
    private readonly ziService: ZiService,
    private readonly ocrService: OcrService,
  ) {}

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeZiDto) {
    return this.ziService.analyze(dto.zi, dto.handwriting);
  }

  @Post('recognize')
  async recognize(@Body() dto: RecognizeDto) {
    const result = await this.ocrService.recognizeHandwriting(dto.image);
    return {
      recognizedZi: result.zi,
      confidence: result.confidence,
    };
  }

  @Post('analyze-handwriting')
  async analyzeHandwriting(@Body() dto: AnalyzeHandwritingDto) {
    // 1. 识别文字
    const ocrResult = await this.ocrService.recognizeHandwriting(dto.image);
    const zi = ocrResult.zi;
    
    if (!zi) {
      return {
        recognizedZi: null,
        error: '未能识别出汉字',
      };
    }
    
    // 2. 分析字义
    const analysis = await this.ziService.analyze(zi);
    
    return {
      recognizedZi: zi,
      confidence: ocrResult.confidence,
      analysis,
    };
  }
}
