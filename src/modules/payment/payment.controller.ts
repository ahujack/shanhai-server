import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // 获取支付配置状态
  @Get('status')
  getPaymentStatus() {
    return {
      stripeConfigured: this.paymentService.isStripeConfigured(),
      creemConfigured: this.paymentService.isCreemConfigured(),
    };
  }

  // Creem 调试信息（仅开发/测试环境）
  @Get('debug/creem')
  @UseGuards(RequireAuthGuard)
  async getCreemDebugInfo(@Query('productId') productId?: string) {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    const allowDebug = env !== 'production' || process.env.ENABLE_PAYMENT_DEBUG === 'true';
    if (!allowDebug) {
      throw new NotFoundException('Not Found');
    }
    return this.paymentService.getCreemDebugInfo(productId);
  }

  // 获取所有可用的支付产品
  @Get('products')
  async getProducts() {
    return this.paymentService.getPaymentProducts();
  }

  // 获取单个产品详情
  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return this.paymentService.getProductById(id);
  }

  // 创建支付会话（返回 Stripe Checkout URL）
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RequireAuthGuard)
  async createCheckout(
    @Body() body: { productId: string },
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const { productId } = body;
    
    // 成功和取消回调 URL
    const baseUrl = process.env.FRONTEND_URL || 'https://shanhai.vercel.app';
    const successUrl = `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/payment/cancel`;
    
    return this.paymentService.createCheckoutSession(
      userId,
      productId,
      successUrl,
      cancelUrl,
    );
  }

  // Stripe Webhook 回调
  @Post('webhook')
  async handleWebhook(@Req() req: any) {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      return { received: true, message: 'No raw body' };
    }

    try {
      return await this.paymentService.handleWebhook(rawBody, signature);
    } catch (error) {
      console.error('Webhook error:', error.message);
      return { received: false, error: error.message };
    }
  }

  // Creem Webhook 回调（需配置 rawBody 以验证签名）
  @Post('webhook/creem')
  async handleCreemWebhook(@Req() req: any) {
    const signature = req.headers['creem-signature'];
    const rawBody = req.rawBody ?? (req.body ? JSON.stringify(req.body) : null);
    const body = req.body;
    try {
      return await this.paymentService.handleCreemWebhook(body, { signature, rawBody });
    } catch (error) {
      console.error('Creem Webhook error:', error.message);
      return { received: false, error: error.message };
    }
  }

  // 模拟支付成功（仅开发/测试环境）
  @Post('mock-payment/:paymentId')
  async mockPayment(@Param('paymentId') paymentId: string) {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    const allowMock = env !== 'production' || process.env.ALLOW_MOCK_PAYMENT === 'true';
    if (!allowMock) {
      throw new NotFoundException('Not Found');
    }
    try {
      const result = await this.paymentService.mockPaymentSuccess(paymentId);
      return { success: true, payment: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取用户支付历史
  @Get('history')
  @UseGuards(RequireAuthGuard)
  async getPaymentHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.id;
    return this.paymentService.getUserPaymentHistory(
      userId,
      limit ? parseInt(limit) : 10,
      offset ? parseInt(offset) : 0,
    );
  }

  // 查询支付状态（用于支付后前端轮询）
  @Get('status/:paymentId')
  @UseGuards(RequireAuthGuard)
  async getPaymentByIdStatus(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
  ) {
    const userId = req.user.id;
    return this.paymentService.getPaymentStatusForUser(userId, paymentId);
  }

}
