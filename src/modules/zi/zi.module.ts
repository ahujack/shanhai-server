import { Module } from '@nestjs/common';
import { ZiService } from './zi.service';
import { ZiController } from './zi.controller';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [OcrModule],
  controllers: [ZiController],
  providers: [ZiService],
  exports: [ZiService],
})
export class ZiModule {}
