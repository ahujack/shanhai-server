import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, Headers } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
  async handleWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
  ) {
    // 这里需要验证 Stripe webhook 签名
    // 实际使用时需要配置 Stripe webhook secret
    
    const event = body;
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        // 处理支付完成
        // 需要从 session 中获取 paymentId
        // 这里简化处理
        break;
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // 处理支付成功
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        // 处理支付失败
        break;
    }
    
    return { received: true };
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
}
