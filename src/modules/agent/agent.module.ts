import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { PersonaModule } from '../persona/persona.module';
import { ReadingModule } from '../reading/reading.module';
import { FortuneModule } from '../fortune/fortune.module';
import { ChartModule } from '../chart/chart.module';
import { MeditationModule } from '../meditation/meditation.module';
import { ZiModule } from '../zi/zi.module';

@Module({
  imports: [PersonaModule, ReadingModule, FortuneModule, ChartModule, MeditationModule, ZiModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
