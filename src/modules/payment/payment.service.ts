import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PointsService } from '../points/points.service';
import axios from 'axios';

// Creem 支付服务 - 仅使用 Creem

@Injectable()
export class PaymentService implements OnModuleInit {
  private creemApiKey: string | null = null;
  private creemApiUrl = 'https://api.creem.io/v1';

  // Creem Price ID 映射
  private readonly CREEM_PRICE_IDS: Record<string, string> = {
    'vip_monthly': 'prod_5na6qH1CfbI4w7Rump4qXA',
    'vip_yearly': 'prod_2ZTZ5wbQQz0QUhxr1saAB7',
  };

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async onModuleInit() {
    // 初始化 Creem
    this.creemApiKey = process.env.CREEM_API_KEY || null;
    if (this.creemApiKey) {
      console.log('Creem initialized successfully');
    } else {
      console.log('Creem not configured - payment will use mock mode');
    }

    // 初始化支付产品
    await this.seedPaymentProducts();
  }

  // 检查 Creem 是否可用
  isCreemConfigured(): boolean {
    return this.creemApiKey !== null;
  }

  // 检查 Stripe（总是返回 false）
  isStripeConfigured(): boolean {
    return false;
  }

  // 获取所有可用的支付产品
  async getPaymentProducts() {
    const products = await this.prisma.paymentProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    
    return products;
  }

  // 获取单个产品详情
  async getProductById(id: string) {
    return this.prisma.paymentProduct.findUnique({
      where: { id },
    });
  }

  // 创建支付会话（使用 Creem）
  async createCheckoutSession(userId: string, productId: string, successUrl: string, cancelUrl: string) {
    const product = await this.prisma.paymentProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 创建支付记录
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        productId,
        amount: product.price,
        points: product.points,
        status: 'pending',
      },
    });

    // 检查是否有 Creem Price ID
    const creemPriceId = product.creemPriceId || this.CREEM_PRICE_IDS[product.code];
    
    // 如果没有配置 Creem，返回模拟支付
    if (!this.creemApiKey || !creemPriceId) {
      return {
        paymentId: payment.id,
        sessionId: `mock_session_${payment.id}`,
        url: `${cancelUrl}?paymentId=${payment.id}&mock=true`,
        mock: true,
        message: 'Creem not configured, this is a mock payment',
      };
    }

    // 使用 Creem 创建支付会话
    return this.createCreemCheckout(userId, payment.id, creemPriceId, successUrl, cancelUrl);
  }

  // 创建 Creem Checkout
  private async createCreemCheckout(
    userId: string,
    paymentId: string,
    creemProductId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    try {
      const response = await axios.post(
        `${this.creemApiUrl}/checkouts`,
        {
          product_id: creemProductId,
          success_url: `${successUrl}?paymentId=${paymentId}`,
          metadata: {
            paymentId,
            userId,
          },
        },
        {
          headers: {
            'x-api-key': this.creemApiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      const checkout = response.data;

      // 更新支付记录的 Creem Checkout ID
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { creemCheckoutId: checkout.id },
      });

      return {
        paymentId,
        sessionId: checkout.id,
        url: checkout.url,
        provider: 'creem',
      };
    } catch (error) {
      console.error('Creem checkout error:', error.response?.data || error.message);
      throw new Error(`Creem checkout failed: ${error.message}`);
    }
  }

  // 处理 Creem Webhook
  async handleCreemWebhook(body: any) {
    const event = body;
    
    if (event.event === 'checkout.completed') {
      const checkout = event.data;
      const paymentId = checkout.metadata?.paymentId;
      
      if (paymentId) {
        await this.processPaymentSuccess(paymentId, checkout.id, 'completed');
      }
    }
    
    return { received: true };
  }

  // 处理 Stripe Webhook（不再支持）
  async handleWebhook(body: any, signature: string) {
    throw new Error('Stripe is no longer supported. Please use Creem webhooks instead.');
  }

  // 处理支付成功
  async processPaymentSuccess(paymentId: string, providerPaymentId?: string, status?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { product: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // 如果已经处理过，跳过
    if (payment.status === 'completed') {
      return payment;
    }

    // 更新支付状态
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        creemCheckoutId: providerPaymentId,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // 1. 如果是积分产品，添加积分
    if (payment.points > 0) {
      await this.pointsService.awardPoints(
        payment.userId,
        payment.points,
        'recharge',
        `充值：${payment.product.name}`,
      );
    }

    // 2. 如果是订阅产品，更新用户会员状态
    if (payment.product.type === 'subscription') {
      const periodDays = payment.product.periodDays || 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + periodDays);

      // 更新用户会员状态
      await this.prisma.user.update({
        where: { id: payment.userId },
        data: {
          membership: payment.product.code.includes('vip') ? 'vip' : 'premium',
        },
      });
    }

    return updatedPayment;
  }

  // 模拟支付成功（用于测试）
  async mockPaymentSuccess(paymentId: string) {
    return this.processPaymentSuccess(paymentId, `mock_${paymentId}`, 'completed');
  }

  // 获取用户支付历史
  async getUserPaymentHistory(userId: string, limit = 10, offset = 0) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // 初始化支付产品数据
  private async seedPaymentProducts() {
    const existingProducts = await this.prisma.paymentProduct.count();
    
    if (existingProducts > 0) {
      return;
    }

    const products = [
      {
        code: 'points_100',
        name: '100 积分',
        description: '100 积分，用于解锁高级功能',
        type: 'points',
        price: 0.99,
        points: 100,
        sortOrder: 1,
      },
      {
        code: 'points_500',
        name: '500 积分',
        description: '500 积分，享受9折优惠',
        type: 'points',
        price: 4.49,
        points: 500,
        sortOrder: 2,
      },
      {
        code: 'points_1000',
        name: '1000 积分',
        description: '1000 积分，享受85折优惠',
        type: 'points',
        price: 7.99,
        points: 1000,
        sortOrder: 3,
      },
      {
        code: 'points_3000',
        name: '3000 积分',
        description: '3000 积分，享受8折优惠',
        type: 'points',
        price: 19.99,
        points: 3000,
        sortOrder: 4,
      },
      {
        code: 'vip_monthly',
        name: 'VIP 月卡',
        description: '解锁所有VIP功能，包括无限AI对话、高级命盘解读等',
        type: 'subscription',
        price: 4.99,
        points: 0,
        periodDays: 30,
        features: JSON.stringify(['无限AI对话', '高级命盘解读', '优先客服', '专属主题']),
        creemPriceId: 'prod_5na6qH1CfbI4w7Rump4qXA',
        sortOrder: 10,
      },
      {
        code: 'vip_yearly',
        name: 'VIP 年卡',
        description: '解锁所有VIP功能，享受年卡优惠',
        type: 'subscription',
        price: 39.99,
        points: 0,
        periodDays: 365,
        features: JSON.stringify(['无限AI对话', '高级命盘解读', '优先客服', '专属主题', '年费专属优惠']),
        creemPriceId: 'prod_2ZTZ5wbQQz0QUhxr1saAB7',
        sortOrder: 11,
      },
    ];

    for (const product of products) {
      await this.prisma.paymentProduct.upsert({
        where: { code: product.code },
        update: {
          // 更新现有产品的缺失字段
          periodDays: product.periodDays,
          creemPriceId: product.creemPriceId,
        },
        create: product,
      });
    }

    console.log('Payment products seeded successfully');
  }
}
