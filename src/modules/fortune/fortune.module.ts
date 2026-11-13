import { Module } from '@nestjs/common';
import { FortuneService } from './fortune.service';
import { FortuneController } from './fortune.controller';
import { ComicImageService } from './comic-image.service';

@Module({
  controllers: [FortuneController],
  providers: [FortuneService, ComicImageService],
  exports: [FortuneService],
})
export class FortuneModule {}
