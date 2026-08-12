import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(RequireAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('deep-destiny/latest')
  async latest(@Req() req: { user: { sub: string } }) {
    const report = await this.reportsService.getLatestForUser(req.user.sub);
    return { report };
  }

  @Get('deep-destiny/:paymentId')
  async byPayment(
    @Req() req: { user: { sub: string } },
    @Param('paymentId') paymentId: string,
  ) {
    const report = await this.reportsService.getByPaymentId(req.user.sub, paymentId);
    return { report };
  }

  @Post('deep-destiny/:paymentId/refresh')
  async refresh(
    @Req() req: { user: { sub: string } },
    @Param('paymentId') paymentId: string,
  ) {
    const report = await this.reportsService.fulfillDeepDestinyReport(
      req.user.sub,
      paymentId,
    );
    return { report };
  }
}
