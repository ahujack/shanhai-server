import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('用户未登录');
    }
    const { productId } = body;
    
    // Creem 不会替换 Stripe 的 {CHECKOUT_SESSION_ID}，只使用干净路径；paymentId 由服务端 append 到 success_url
    const baseUrl = (process.env.FRONTEND_URL || 'https://www.shanhai.app').replace(/\/$/, '');
    const successUrl = `${baseUrl}/payment/success`;
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
  @HttpCode(HttpStatus.OK)
  async handleCreemWebhook(@Req() req: any) {
    const signature = req.headers['creem-signature'] as string | undefined;
    const rawBody = (() => {
      const rb = req.rawBody;
      if (Buffer.isBuffer(rb)) return rb.toString('utf8');
      if (typeof rb === 'string') return rb;
      return req.body ? JSON.stringify(req.body) : undefined;
    })();
    const body = req.body;
    // 勿吞掉异常：签名校验失败须返回 4xx，Creem 才会按策略重试；此前 catch 后仍 200 会导致控制台显示成功但业务未入账
    return this.paymentService.handleCreemWebhook(body, { signature, rawBody });
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
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('用户未登录');
    }
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
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('用户未登录');
    }
    return this.paymentService.getPaymentStatusForUser(userId, paymentId);
  }

}
