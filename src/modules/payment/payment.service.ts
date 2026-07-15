import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';
import type { Prisma } from '@prisma/client';

// Creem 支付服务 - 仅使用 Creem

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private creemApiKey: string | null = null;
  private creemApiUrl = 'https://api.creem.io/v1';
  private readonly creemRequestTimeoutMs = Number(
    process.env.CREEM_TIMEOUT_MS || 15000,
  );
  private readonly paymentSourceTag =
    process.env.PAYMENT_SOURCE_TAG || 'server_payment';

  /**
   * 代码内默认 Creem product_id（可被环境变量 CREEM_PRODUCT_<CODE> 覆盖，CODE 为大写+下划线，如 POINTS_100）
   * 积分包需在 Creem 各建一个一次性商品，把 prod_xxx 配进环境变量或库里的 creemPriceId
   */
  private readonly CREEM_PRICE_IDS: Record<string, string> = {
    vip_monthly: 'prod_78ZYwOA5jnKNJ8ub1Xwtra',
    vip_yearly: 'prod_2mQYQ2Hl5ylTkRKgEhVvbG',
  };

  /** 解析最终用于下单的 Creem 产品 ID（env > 代码映射 > 数据库） */
  private resolvedCreemProductId(
    productCode: string,
    dbCreemPriceId: string | null | undefined,
  ): string | undefined {
    const envKey = `CREEM_PRODUCT_${productCode.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) return fromEnv;
    const mapped = this.CREEM_PRICE_IDS[productCode];
    if (mapped) return mapped;
    const fromDb = dbCreemPriceId?.trim();
    if (fromDb) return fromDb;
    return undefined;
  }

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // 初始化 Creem
    this.creemApiKey = process.env.CREEM_API_KEY || null;
    const base = (
      process.env.CREEM_API_URL || 'https://api.creem.io/v1'
    ).replace(/\/$/, '');
    this.creemApiUrl = base;
    if (this.creemApiKey) {
      this.logger.log('Creem initialized successfully');
    } else {
      this.logger.warn('Creem not configured - payment will use mock mode');
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

  // 获取 Creem 调试信息（仅用于排查环境问题）
  async getCreemDebugInfo(targetProductId?: string) {
    const products = await this.prisma.paymentProduct.findMany({
      where: {
        ...(targetProductId
          ? {
              OR: [{ id: targetProductId }, { code: targetProductId }],
            }
          : { type: 'subscription' }),
      },
      orderBy: { sortOrder: 'asc' },
    });

    const key = this.creemApiKey || '';
    const keyFingerprint = key
      ? `${key.slice(0, 6)}...${key.slice(-4)} (len=${key.length})`
      : null;

    return {
      creemConfigured: !!this.creemApiKey,
      creemApiUrl: this.creemApiUrl,
      keyFingerprint,
      productCount: products.length,
      products: products.map((product) => {
        const envKey = `CREEM_PRODUCT_${product.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
        const resolved =
          this.resolvedCreemProductId(product.code, product.creemPriceId) ||
          null;
        const fromEnv = !!process.env[envKey]?.trim();
        return {
          id: product.id,
          code: product.code,
          type: product.type,
          dbCreemProductId: product.creemPriceId,
          envVarHint: envKey,
          resolvedCreemProductId: resolved,
          source: fromEnv
            ? 'env'
            : this.CREEM_PRICE_IDS[product.code]
              ? 'code_map'
              : product.creemPriceId
                ? 'database'
                : 'none',
        };
      }),
    };
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
  async createCheckoutSession(
    userId: string,
    productId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    this.logger.log(
      `Creating checkout userId=${userId} productRef=${productId} source=${this.paymentSourceTag}`,
    );

    if (!userId) {
      throw new BadRequestException('缺少用户信息，请重新登录后重试');
    }

    if (!productId) {
      throw new BadRequestException('缺少商品参数');
    }

    // 兼容前端传 product.id 或 product.code
    const product = await this.prisma.paymentProduct.findFirst({
      where: {
        OR: [{ id: productId }, { code: productId }],
      },
    });

    if (!product) {
      this.logger.error(`Product not found: ${productId}`);
      throw new NotFoundException('商品不存在或已下架');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      throw new NotFoundException('用户不存在');
    }

    // 创建支付记录
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        productId: product.id,
        amount: product.price,
        points: product.points,
        status: 'pending',
      },
    });
    this.logger.log(
      `Payment created paymentId=${payment.id} userId=${userId} amount=${payment.amount} code=${product.code}`,
    );

    const creemPriceId = this.resolvedCreemProductId(
      product.code,
      product.creemPriceId,
    );
    this.logger.log(
      `Checkout product resolved paymentId=${payment.id} code=${product.code} creemProductId=${creemPriceId || 'none'} apiKey=${!!this.creemApiKey}`,
    );

    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const allowMockInProd = process.env.ALLOW_MOCK_PAYMENT === 'true';

    // 未配置 API Key：仅本地/测试允许模拟支付；生产默认拒绝
    if (!this.creemApiKey) {
      if (isProd && !allowMockInProd) {
        this.logger.error(
          'Creem API key missing in production, checkout blocked',
        );
        throw new InternalServerErrorException('支付服务配置异常，请稍后重试');
      }
      this.logger.warn('Creem not configured, returning mock payment');
      return {
        paymentId: payment.id,
        sessionId: `mock_session_${payment.id}`,
        url: `${this.appendQueryParam(cancelUrl, 'paymentId', payment.id)}&mock=true`,
        mock: true,
        message: 'Creem not configured, this is a mock payment',
      };
    }

    // 已接 Creem 但该商品未绑定产品 ID：勿再返回假 URL，避免前端「点了没进收银台」
    if (!creemPriceId) {
      this.logger.error(
        `Payment product missing Creem binding code=${product.code} productId=${product.id} env=CREEM_PRODUCT_${product.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
      );
      throw new BadRequestException(
        '该方案暂时不可购买，请稍后再试或联系客服 support@shanhai.app',
      );
    }

    return this.createCreemCheckout(
      userId,
      payment.id,
      creemPriceId,
      successUrl,
      cancelUrl,
    );
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
      const successCallbackUrl = this.appendQueryParam(
        successUrl,
        'paymentId',
        paymentId,
      );

      const response = await axios.post(
        `${this.creemApiUrl}/checkouts`,
        {
          product_id: creemProductId,
          success_url: successCallbackUrl,
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
          timeout: this.creemRequestTimeoutMs,
        },
      );

      const checkout = response.data;
      const checkoutUrl =
        checkout?.url ||
        checkout?.checkout_url ||
        checkout?.hosted_checkout_url ||
        checkout?.hosted_url ||
        null;

      // 更新支付记录的 Creem Checkout ID
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { creemCheckoutId: checkout.id },
      });

      return {
        paymentId,
        sessionId: checkout.id,
        url: checkoutUrl,
        provider: 'creem',
      };
    } catch (error: any) {
      const providerError = error?.response?.data;
      const providerStatus = error?.response?.status;
      const providerMessage =
        providerError?.message ||
        providerError?.error ||
        error?.message ||
        'unknown error';
      this.logger.error(
        `Creem checkout error paymentId=${paymentId} message=${providerMessage}`,
      );
      this.logger.error(
        `Creem checkout detail: ${JSON.stringify(providerError || {})}`,
      );
      if (
        typeof providerStatus === 'number' &&
        providerStatus >= 400 &&
        providerStatus < 500
      ) {
        throw new BadRequestException(`创建支付会话失败：${providerMessage}`);
      }
      throw new InternalServerErrorException(
        `创建支付会话失败：${providerMessage}`,
      );
    }
  }

  /** 解析 creem-signature（纯 hex，或带 sha256=/v1= 等前缀） */
  private normalizeCreemSignatureHeader(signatureHeader: string): string {
    const s = String(signatureHeader).trim();
    if (!s) return '';
    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1] ?? s;
    if (last.includes('=')) {
      return last.split('=').pop()!.trim().replace(/^0x/i, '').toLowerCase();
    }
    return last.replace(/^0x/i, '').toLowerCase();
  }

  private creemHmacHexValid(
    rawBody: string,
    signatureHeader: string,
    hmacSecret: string,
  ): boolean {
    if (!rawBody || !hmacSecret) return false;
    const sigHex = this.normalizeCreemSignatureHeader(signatureHeader);
    if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length % 2 !== 0) return false;
    const computed = crypto
      .createHmac('sha256', hmacSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    try {
      return (
        computed.length === sigHex.length &&
        crypto.timingSafeEqual(
          Buffer.from(computed, 'hex'),
          Buffer.from(sigHex, 'hex'),
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * HMAC 与原文不一致时（例如经 Vercel 等对 JSON 重写），用 API 拉取 checkout 与 Creem 侧 metadata 对齐后视为可信
   */
  private async verifyCheckoutCompletedAgainstCreemApi(
    body: any,
  ): Promise<boolean> {
    if (!this.creemApiKey) return false;
    const eventType = body?.eventType ?? body?.event;
    if (eventType !== 'checkout.completed') return false;
    const obj = body?.object ?? body?.data;
    const checkoutId = obj?.id;
    if (!checkoutId || typeof checkoutId !== 'string') return false;
    try {
      const { data: checkout } = await axios.get(
        `${this.creemApiUrl}/checkouts`,
        {
          params: { checkout_id: checkoutId },
          headers: { 'x-api-key': this.creemApiKey },
          timeout: this.creemRequestTimeoutMs,
        },
      );
      if (checkout?.status !== 'completed') return false;
      const trustedPid = checkout.metadata?.paymentId;
      if (!trustedPid || typeof trustedPid !== 'string') return false;
      const claimedPid = obj?.metadata?.paymentId;
      if (claimedPid != null && claimedPid !== trustedPid) return false;
      return true;
    } catch (e: any) {
      this.logger.warn(
        `Creem API 校验 webhook checkout 失败: ${e?.message || e}`,
      );
      return false;
    }
  }

  // 处理 Creem Webhook（可选签名验证；载荷字段为 eventType + object，见官方文档）
  async handleCreemWebhook(
    body: any,
    opts?: { signature?: string; rawBody?: string | Buffer },
  ) {
    const secret = process.env.CREEM_WEBHOOK_SECRET?.trim();
    const raw =
      opts?.rawBody != null
        ? typeof opts.rawBody === 'string'
          ? opts.rawBody
          : Buffer.isBuffer(opts.rawBody)
            ? opts.rawBody.toString('utf8')
            : String(opts.rawBody)
        : '';

    let trustWebhook = false;
    if (!secret) {
      if (this.creemApiKey) {
        this.logger.error(
          'Creem Webhook 拒绝处理：CREEM_WEBHOOK_SECRET 未配置',
        );
        throw new BadRequestException('Webhook secret not configured');
      }
      // 本地未接 Creem API Key 的调试环境允许透传
      trustWebhook = true;
    } else {
      if (!opts?.signature) {
        this.logger.warn(
          'Creem Webhook 已配置 CREEM_WEBHOOK_SECRET 但缺少 creem-signature 请求头',
        );
        throw new BadRequestException('Webhook signature required');
      }
      if (raw) {
        if (this.creemHmacHexValid(raw, opts.signature, secret)) {
          trustWebhook = true;
        } else if (
          this.creemApiKey &&
          this.creemHmacHexValid(raw, opts.signature, this.creemApiKey.trim())
        ) {
          this.logger.warn(
            'Creem Webhook：HMAC 使用了 CREEM_API_KEY 才通过。请将 Railway 的 CREEM_WEBHOOK_SECRET 设为 Creem 后台该 Webhook 的 Signing secret（与 API Key 不同）。',
          );
          trustWebhook = true;
        }
      }
      if (!trustWebhook) {
        const apiOk = await this.verifyCheckoutCompletedAgainstCreemApi(body);
        if (apiOk) {
          this.logger.warn(
            'Creem Webhook：HMAC 未通过，已用 Creem API 校验 checkout.completed（常见于经反向代理改写 body）。',
          );
          trustWebhook = true;
        }
      }
      if (!trustWebhook) {
        this.logger.warn('Creem Webhook 签名验证失败');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    const eventType: string | undefined = body?.eventType ?? body?.event;
    const payload = body?.object ?? body?.data;

    if (eventType === 'checkout.completed' && payload?.object === 'checkout') {
      const checkout = payload;
      const paymentId = checkout.metadata?.paymentId;
      if (paymentId) {
        await this.processPaymentSuccess(paymentId, checkout.id, 'completed');
      } else {
        this.logger.warn('Creem checkout.completed 缺少 metadata.paymentId');
      }
    } else if (eventType === 'checkout.completed' && payload) {
      // 兼容无 object 字段的 checkout 载荷
      const paymentId = payload.metadata?.paymentId;
      if (paymentId) {
        await this.processPaymentSuccess(paymentId, payload.id, 'completed');
      }
    } else if (
      eventType === 'subscription.paid' &&
      payload?.metadata?.paymentId
    ) {
      await this.processPaymentSuccess(
        payload.metadata.paymentId,
        payload.id,
        'completed',
      );
    } else if (eventType) {
      this.logger.debug(`Creem Webhook 未处理的事件类型: ${eventType}`);
    }

    return { received: true };
  }

  /** 支付仍为 pending 时向 Creem 查询 checkout，作为 webhook 未送达时的兜底 */
  private async trySyncPaymentFromCreem(paymentId: string): Promise<void> {
    if (!this.creemApiKey) return;
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!row || row.status !== 'pending' || !row.creemCheckoutId) return;
    try {
      const response = await axios.get(`${this.creemApiUrl}/checkouts`, {
        params: { checkout_id: row.creemCheckoutId },
        headers: { 'x-api-key': this.creemApiKey },
        timeout: this.creemRequestTimeoutMs,
      });
      const checkout = response.data;
      const status = checkout?.status;
      if (status === 'completed') {
        await this.processPaymentSuccess(
          paymentId,
          checkout.id ?? row.creemCheckoutId,
          'completed',
        );
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'unknown';
      this.logger.debug(
        `Creem checkout 同步失败 paymentId=${paymentId}: ${msg}`,
      );
    }
  }

  // 处理 Stripe Webhook（不再支持）
  async handleWebhook(body: any, signature: string) {
    throw new BadRequestException('Stripe 已停用，请使用 Creem webhook');
  }

  // 处理支付成功
  async processPaymentSuccess(
    paymentId: string,
    providerPaymentId?: string,
    _status?: string,
  ) {
    this.logger.log(
      `Process payment success start paymentId=${paymentId} providerPaymentId=${providerPaymentId || 'none'}`,
    );
    const txResult = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { product: true },
      });

      if (!payment) {
        throw new NotFoundException('支付记录不存在');
      }

      // 如果已经处理过，跳过
      if (payment.status === 'completed') {
        this.logger.log(
          `Payment already completed paymentId=${paymentId}, skip side effects`,
        );
        return {
          payment,
          justCompleted: false,
          userId: payment.userId,
          productType: payment.product.type,
          amount: payment.amount,
          points: payment.points,
          productCode: payment.product.code,
        };
      }

      // 原子幂等：仅允许 pending -> completed
      const updateResult = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: 'pending',
        },
        data: {
          creemCheckoutId: providerPaymentId,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const latest = await tx.payment.findUnique({
          where: { id: paymentId },
        });
        if (!latest) {
          throw new NotFoundException('支付记录不存在');
        }
        this.logger.log(
          `Payment completion race detected paymentId=${paymentId}, skip duplicate apply`,
        );
        return {
          payment: latest,
          justCompleted: false,
          userId: payment.userId,
          productType: payment.product.type,
          amount: payment.amount,
          points: payment.points,
          productCode: payment.product.code,
        };
      }

      const updatedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (!updatedPayment) {
        throw new NotFoundException('支付记录不存在');
      }

      // 1. 如果是积分产品，添加积分与流水（同事务）
      if (payment.points > 0) {
        const currentPoints = await tx.userPoints.findUnique({
          where: { userId: payment.userId },
        });
        if (!currentPoints) {
          await tx.userPoints.create({
            data: {
              userId: payment.userId,
              totalPoints: payment.points,
              availablePoints: payment.points,
            },
          });
        } else {
          await tx.userPoints.update({
            where: { userId: payment.userId },
            data: {
              totalPoints: { increment: payment.points },
              availablePoints: { increment: payment.points },
            },
          });
        }
        await tx.pointRecord.create({
          data: {
            userId: payment.userId,
            points: payment.points,
            type: 'recharge',
            description: `充值：${payment.product.name}`,
          },
        });
      }

      // 2. 如果是订阅产品，更新用户会员状态及到期时间（在现有未过期会员上叠加时长）
      if (payment.product.type === 'subscription') {
        const periodDays = payment.product.periodDays || 30;
        const existing = await tx.user.findUnique({
          where: { id: payment.userId },
          select: { membershipExpiryAt: true },
        });
        const now = new Date();
        let base = now;
        if (existing?.membershipExpiryAt && existing.membershipExpiryAt > now) {
          base = existing.membershipExpiryAt;
        }
        const expiryDate = new Date(base);
        expiryDate.setDate(expiryDate.getDate() + periodDays);

        await tx.user.update({
          where: { id: payment.userId },
          data: {
            membership: payment.product.code.includes('vip')
              ? 'vip'
              : 'premium',
            membershipExpiryAt: expiryDate,
          },
        });
      }

      return {
        payment: updatedPayment,
        justCompleted: true,
        userId: payment.userId,
        productType: payment.product.type,
        amount: payment.amount,
        points: payment.points,
        productCode: payment.product.code,
      };
    });
    if (txResult.justCompleted) {
      const existing = await this.prisma.analyticsEvent.findFirst({
        where: {
          userId: txResult.userId,
          name: 'payment_success',
          props: {
            path: ['paymentId'],
            equals: paymentId,
          },
        },
        select: { id: true },
      });
      if (!existing) {
        const paymentSuccessProps: Prisma.InputJsonValue = {
          paymentId,
          productType: txResult.productType,
          productCode: txResult.productCode,
          amount: txResult.amount,
          points: txResult.points,
          providerPaymentId: providerPaymentId || null,
          source: this.paymentSourceTag,
        } as Prisma.InputJsonValue;
        await this.prisma.analyticsEvent.create({
          data: {
            userId: txResult.userId,
            name: 'payment_success',
            props: paymentSuccessProps,
          },
        });
      } else {
        this.logger.warn(
          `Skip duplicated payment_success analytics paymentId=${paymentId} eventId=${existing.id}`,
        );
      }
      this.logger.log(
        `Payment completion applied paymentId=${paymentId} userId=${txResult.userId} type=${txResult.productType} amount=${txResult.amount}`,
      );
    }
    return txResult.payment;
  }

  // 模拟支付成功（用于测试）
  async mockPaymentSuccess(paymentId: string) {
    return this.processPaymentSuccess(
      paymentId,
      `mock_${paymentId}`,
      'completed',
    );
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

  // 查询支付状态（用于前端轮询支付完成）
  async getPaymentStatusForUser(userId: string, paymentId: string) {
    let payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { product: true },
    });

    if (!payment) {
      throw new NotFoundException('支付记录不存在');
    }
    if (payment.userId !== userId) {
      throw new BadRequestException('无权查看该支付记录');
    }

    if (payment.status === 'pending') {
      await this.trySyncPaymentFromCreem(paymentId);
      payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { product: true },
      });
      if (!payment) {
        throw new NotFoundException('支付记录不存在');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { membership: true, membershipExpiryAt: true },
    });

    return {
      paymentId: payment.id,
      status: payment.status,
      productType: payment.product.type,
      membership: user?.membership || 'free',
      membershipExpiryAt: user?.membershipExpiryAt
        ? user.membershipExpiryAt.toISOString()
        : null,
      completedAt: payment.completedAt,
    };
  }

  // 初始化支付产品数据
  private async seedPaymentProducts() {
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
        description: '30天会员权益，覆盖高频核心能力',
        type: 'subscription',
        price: 5.9,
        points: 0,
        periodDays: 30,
        features: JSON.stringify([
          '测字按规则免扣积分（受频控限制）',
          '深度解签按规则免扣积分（受频控限制）',
          '解锁八字老师傅批注（会员权益）',
          '解锁测字甲骨文完整异体图与差异解读',
          '支持到期续费，会员时长可叠加',
        ]),
        creemPriceId: 'prod_78ZYwOA5jnKNJ8ub1Xwtra',
        sortOrder: 10,
      },
      {
        code: 'vip_yearly',
        name: 'VIP 年卡',
        description: '365天会员权益，同能力更划算',
        type: 'subscription',
        price: 49.9,
        points: 0,
        periodDays: 365,
        features: JSON.stringify([
          '包含月卡全部会员权益',
          '测字/深度解签按规则免扣积分（受频控限制）',
          '解锁八字老师傅批注（会员权益）',
          '解锁测字甲骨文完整异体图与差异解读',
          '年付更省：约等于 8.5 个月月卡价格',
        ]),
        creemPriceId: 'prod_2mQYQ2Hl5ylTkRKgEhVvbG',
        sortOrder: 11,
      },
    ];

    for (const product of products) {
      await this.prisma.paymentProduct.upsert({
        where: { code: product.code },
        update: {
          // 保证历史数据也会被修正到最新配置
          name: product.name,
          description: product.description,
          type: product.type,
          price: product.price,
          points: product.points,
          sortOrder: product.sortOrder,
          features: product.features,
          periodDays: product.periodDays,
          creemPriceId: product.creemPriceId,
        },
        create: product,
      });
    }

    this.logger.log('Payment products seeded successfully');
  }

  private appendQueryParam(url: string, key: string, value: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${key}=${encodeURIComponent(value)}`;
  }
}
