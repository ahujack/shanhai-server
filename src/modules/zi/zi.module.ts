import { Module } from '@nestjs/common';
import { ZiService } from './zi.service';
import { ZiController } from './zi.controller';
import { OcrModule } from '../ocr/ocr.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [OcrModule, PointsModule],
  controllers: [ZiController],
  providers: [ZiService],
  exports: [ZiService],
})
export class ZiModule {}
