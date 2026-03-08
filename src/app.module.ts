import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma.module';
import { HealthModule } from './modules/health/health.module';
import { PersonaModule } from './modules/persona/persona.module';
import { ReadingModule } from './modules/reading/reading.module';
import { AgentModule } from './modules/agent/agent.module';
import { UserModule } from './modules/user/user.module';
import { ChartModule } from './modules/chart/chart.module';
import { FortuneModule } from './modules/fortune/fortune.module';
import { MeditationModule } from './modules/meditation/meditation.module';
import { ZiModule } from './modules/zi/zi.module';
import { CheckInModule } from './modules/checkin/checkin.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { PointsModule } from './modules/points/points.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'shanhai-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    HealthModule, 
    PersonaModule, 
    ReadingModule, 
    AgentModule,
    UserModule,
    ChartModule,
    FortuneModule,
    MeditationModule,
    ZiModule,
    CheckInModule,
    AchievementModule,
    PointsModule,
  ],
})
export class AppModule {}
