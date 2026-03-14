import { Module } from '@nestjs/common';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';
import { PointsModule } from '../points/points.module';
import { PrismaModule } from '../../prisma.module';

@Module({
  imports: [PrismaModule, PointsModule],
  controllers: [ReadingController],
  providers: [ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}

