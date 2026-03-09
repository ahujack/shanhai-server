import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PointsService } from '../points/points.service';
import Stripe from 'stripe';
import axios from 'axios';

@Injectable()
export class PaymentService implements OnModuleInit {
  private stripe: Stripe | null = null;
  private creemApiKey: string | null = null;
  private creemApiUrl = 'https://api.creem.io/v1';

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async onModuleInit() {
    // 初始化 Stripe
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
      console.log('Stripe initialized successfully');
    } else {
      console.log('Stripe not configured, using mock payment');
    }

    // 初始化 Creem
    this.creemApiKey = process.env.CREEM_API_KEY || null;
    if (this.creemApiKey) {
      console.log('Creem initialized successfully');
    } else {
      console.log('Creem not configured');
    }

    // 初始化支付产品
    await this.seedPaymentProducts();
  }

  // 检查 Stripe 是否可用
  isStripeConfigured(): boolean {
    return this.stripe !== null;
  }

  // 检查 Creem 是否可用
  isCreemConfigured(): boolean {
    return this.creemApiKey !== null;
  }

  // 获取所有可用的支付产品
  async getPaymentProducts() {
    const products = await this.prisma.paymentProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    
    // 如果 Stripe 未配置，返回模拟数据
    if (!this.stripe) {
      return products.map(p => ({
        ...p,
        stripePriceId: null,
      }));
    }
    
    return products;
  }

  // 获取单个产品详情
  async getProductById(id: string) {
    return this.prisma.paymentProduct.findUnique({
      where: { id },
    });
  }

  // 创建 Stripe Checkout Session
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

    // 如果 Creem 已配置，优先使用 Creem
    if (this.creemApiKey && product.creemPriceId) {
      return this.createCreemCheckout(userId, payment.id, product.creemPriceId, successUrl, cancelUrl);
    }

    // 如果 Stripe 未配置，返回模拟数据
    if (!this.stripe) {
      return {
        paymentId: payment.id,
        sessionId: `mock_session_${payment.id}`,
        url: `${cancelUrl}?paymentId=${payment.id}&mock=true`,
        mock: true,
        message: 'Stripe not configured, this is a mock payment',
      };
    }

    // 构建 Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description || undefined,
            },
            unit_amount: Math.round(product.price * 100), // Stripe 使用分
          },
          quantity: 1,
        },
      ],
      mode: product.type === 'subscription' ? 'subscription' : 'payment',
      success_url: successUrl.replace('{CHECKOUT_SESSION_ID}', '{SESSION_ID}'),
      cancel_url: cancelUrl,
      metadata: {
        paymentId: payment.id,
        userId: userId,
        productId: productId,
      },
      // 为订阅添加客户邮箱
      customer_email: user.email,
    };

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    // 更新支付记录的 Stripe Session ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    return {
      paymentId: payment.id,
      sessionId: session.id,
      url: session.url,
    };
  }

  // 创建 Creem Checkout
  private async createCreemCheckout(
    userId: string,
    paymentId: string,
    creemPriceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    try {
      const response = await axios.post(
        `${this.creemApiUrl}/checkouts`,
        {
          price_id: creemPriceId,
          success_url: `${successUrl}?paymentId=${paymentId}`,
          cancel_url: `${cancelUrl}?paymentId=${paymentId}`,
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

  // 处理支付回调（Stripe Webhook）
  async handleWebhook(body: any, signature: string) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId;
        
        if (paymentId) {
          await this.processPaymentSuccess(paymentId, session.id, 'completed');
        }
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // 可以通过 paymentIntent.metadata 找到对应的 payment 记录
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // 处理支付失败
        break;
      }
    }

    return { received: true };
  }

  // 处理支付成功
  async processPaymentSuccess(paymentId: string, stripePaymentId?: string, status?: string) {
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
        stripePaymentId,
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
        update: {},
        create: product,
      });
    }

    console.log('Payment products seeded successfully');
  }

  // 更新产品的 Creem Price ID
  async updateProductsCreemPriceId() {
    const updates = [
      { code: 'vip_monthly', creemPriceId: 'prod_5na6qH1CfbI4w7Rump4qXA' },
      { code: 'vip_yearly', creemPriceId: 'prod_2ZTZ5wbQQz0QUhxr1saAB7' },
    ];

    const results: any[] = [];
    for (const update of updates) {
      const product = await this.prisma.paymentProduct.update({
        where: { code: update.code },
        data: { creemPriceId: update.creemPriceId },
      });
      results.push(product);
    }

    return { success: true, products: results };
  }
}
