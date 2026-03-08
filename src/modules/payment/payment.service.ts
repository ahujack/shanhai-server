import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PointsService } from '../points/points.service';

@Injectable()
export class PaymentService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async onModuleInit() {
    // 初始化支付产品
    await this.seedPaymentProducts();
  }

  // 获取所有可用的支付产品
  async getPaymentProducts() {
    return this.prisma.paymentProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
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

    // 这里需要集成 Stripe
    // 由于 Stripe 需要服务端配置，这里返回一个模拟的 session
    // 实际使用时需要安装 stripe 包并配置
    
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

    return {
      paymentId: payment.id,
      sessionId: `session_${payment.id}`,
      url: `${cancelUrl}?paymentId=${payment.id}`,
      // 实际 Stripe checkout URL（需要配置 Stripe）
      // checkoutUrl: 'https://checkout.stripe.com/...',
    };
  }

  // 处理支付回调（Stripe Webhook）
  async handlePaymentCallback(paymentId: string, stripePaymentId: string, status: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { product: true },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // 更新支付状态
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        stripePaymentId,
        status: status === 'succeeded' ? 'completed' : 'failed',
        completedAt: status === 'succeeded' ? new Date() : null,
      },
    });

    // 如果支付成功，添加积分
    if (status === 'succeeded' && payment.points > 0) {
      await this.pointsService.awardPoints(
        payment.userId,
        payment.points,
        'recharge',
        `充值：${payment.product.name}`,
      );
    }

    return updatedPayment;
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
}
