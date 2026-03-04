import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PersonaModule } from './modules/persona/persona.module';
import { ReadingModule } from './modules/reading/reading.module';
import { AgentModule } from './modules/agent/agent.module';
import { UserModule } from './modules/user/user.module';
import { ChartModule } from './modules/chart/chart.module';
import { FortuneModule } from './modules/fortune/fortune.module';
import { MeditationModule } from './modules/meditation/meditation.module';
import { ZiModule } from './modules/zi/zi.module';

@Module({
  imports: [
    HealthModule, 
    PersonaModule, 
    ReadingModule, 
    AgentModule,
    UserModule,
    ChartModule,
    FortuneModule,
    MeditationModule,
    ZiModule,
  ],
})
export class AppModule {}
