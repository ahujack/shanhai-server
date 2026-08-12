import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { ChartModule } from '../chart/chart.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, ChartModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
