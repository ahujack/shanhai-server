import { Module } from '@nestjs/common';
import { MeditationController } from './meditation.controller';
import { MeditationService } from './meditation.service';

@Module({
  controllers: [MeditationController],
  providers: [MeditationService],
  exports: [MeditationService],
})
export class MeditationModule {}
