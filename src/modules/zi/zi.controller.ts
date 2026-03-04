import { Body, Controller, Post } from '@nestjs/common';
import { ZiService, HandwritingAnalysis } from './zi.service';
import { OcrService } from '../ocr/ocr.service';

export class AnalyzeZiDto {
  zi: string;
  handwriting?: Partial<HandwritingAnalysis>;
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

  // 新增：手写识别接口
  @Post('recognize')
  async recognize(@Body() dto: { image: string }) {
    const result = await this.ocrService.recognizeHandwriting(dto.image);
    return result;
  }

  // 新增：手写识别 + 测字分析
  @Post('analyze-handwriting')
  async analyzeHandwriting(@Body() dto: { image: string }) {
    // 1. 识别手写图片
    const ocrResult = await this.ocrService.recognizeHandwriting(dto.image);
    
    // 2. 如果识别成功，进行测字分析
    if (ocrResult.zi) {
      const ziResult = await this.ziService.analyze(ocrResult.zi);
      return {
        recognizedZi: ocrResult.zi,
        confidence: ocrResult.confidence,
        analysis: ziResult,
      };
    }
    
    return {
      recognizedZi: null,
      confidence: ocrResult.confidence,
      error: '未能识别出汉字',
    };
  }
}
