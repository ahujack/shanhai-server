import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';
import { AuthController } from './auth.controller';
import { UserService } from './user.service';
import { AdminGuard } from '../auth/admin.guard';
import { MailModule } from '../mail/mail.module';
import { PointsModule } from '../points/points.module';
import { AchievementModule } from '../achievement/achievement.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { getJwtSecret } from '../../config/production-env';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
    MailModule,
    forwardRef(() => PointsModule),
    forwardRef(() => AchievementModule),
    AnalyticsModule,
  ],
  controllers: [UserController, AuthController],
  providers: [UserService, AdminGuard],
  exports: [UserService],
})
export class UserModule {}
