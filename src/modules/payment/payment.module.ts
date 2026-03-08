import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PointsModule } from '../points/points.module';
import { PrismaModule } from '../../prisma.module';

@Module({
  imports: [PrismaModule, PointsModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
