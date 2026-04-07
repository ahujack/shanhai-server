import { Module, forwardRef } from '@nestjs/common';
import { CheckInController } from './checkin.controller';
import { CheckInService } from './checkin.service';
import { AchievementModule } from '../achievement/achievement.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [forwardRef(() => AchievementModule), PointsModule],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
