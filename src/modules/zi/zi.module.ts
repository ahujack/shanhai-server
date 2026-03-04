import { Module } from '@nestjs/common';
import { ZiService } from './zi.service';
import { ZiController } from './zi.controller';
import { OcrService } from '../ocr/ocr.service';

@Module({
  controllers: [ZiController],
  providers: [ZiService, OcrService],
  exports: [ZiService],
})
export class ZiModule {}
