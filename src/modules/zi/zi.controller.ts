import { Body, Controller, Post } from '@nestjs/common';
import { ZiService, HandwritingAnalysis } from './zi.service';

export class AnalyzeZiDto {
  zi: string;
  handwriting?: Partial<HandwritingAnalysis>;
}

@Controller('zi')
export class ZiController {
  constructor(private readonly ziService: ZiService) {}

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeZiDto) {
    return this.ziService.analyze(dto.zi, dto.handwriting);
  }
}
