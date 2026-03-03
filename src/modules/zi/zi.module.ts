import { Module } from '@nestjs/common';
import { ZiService } from './zi.service';
import { ZiController } from './zi.controller';

@Module({
  controllers: [ZiController],
  providers: [ZiService],
  exports: [ZiService],
})
export class ZiModule {}
