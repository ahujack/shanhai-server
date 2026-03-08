import { Module, forwardRef } from '@nestjs/common';
import { CheckInController } from './checkin.controller';
import { CheckInService } from './checkin.service';
import { AchievementModule } from '../achievement/achievement.module';

@Module({
  imports: [forwardRef(() => AchievementModule)],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
