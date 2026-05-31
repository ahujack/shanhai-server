/**
 * 运维脚本：手动修复单笔支付（仅在 webhook 异常等特殊场景使用）
 *
 * 用法：
 *   node scripts/reconcile-payment.js --payment-id <id>
 *   node scripts/reconcile-payment.js --payment-id <id> --provider-id <creem_checkout_id>
 *
 * 说明：
 * - 幂等：若支付已 completed，则不会重复发放权益。
 * - 事务：支付状态、积分/会员发放、埋点写入在同一事务内。
 */

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paymentId = String(args['payment-id'] || '').trim();
  const providerId = String(args['provider-id'] || '').trim() || null;

  if (!process.env.DATABASE_URL) {
    console.error('缺少 DATABASE_URL，无法连接数据库');
    process.exit(1);
  }
  if (!paymentId) {
    console.error('请提供 --payment-id');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { product: true },
      });
      if (!payment) throw new Error('支付记录不存在');

      if (payment.status === 'completed') {
        return { alreadyCompleted: true, payment };
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          ...(providerId ? { creemCheckoutId: providerId } : {}),
        },
      });

      if (payment.points > 0) {
        const wallet = await tx.userPoints.findUnique({ where: { userId: payment.userId } });
        if (!wallet) {
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
            description: `补偿入账：${payment.product.name}`,
          },
        });
      }

      if (payment.product.type === 'subscription') {
        const periodDays = payment.product.periodDays || 30;
        const user = await tx.user.findUnique({
          where: { id: payment.userId },
          select: { membershipExpiryAt: true },
        });
        const now = new Date();
        const base = user?.membershipExpiryAt && user.membershipExpiryAt > now ? user.membershipExpiryAt : now;
        const expiryDate = new Date(base);
        expiryDate.setDate(expiryDate.getDate() + periodDays);
        await tx.user.update({
          where: { id: payment.userId },
          data: {
            membership: payment.product.code.includes('vip') ? 'vip' : 'premium',
            membershipExpiryAt: expiryDate,
          },
        });
      }

      const existingEvent = await tx.analyticsEvent.findFirst({
        where: {
          userId: payment.userId,
          name: 'payment_success',
          props: {
            path: ['paymentId'],
            equals: paymentId,
          },
        },
        select: { id: true },
      });
      if (!existingEvent) {
        await tx.analyticsEvent.create({
          data: {
            userId: payment.userId,
            name: 'payment_success',
            props: {
              paymentId,
              productType: payment.product.type,
              productCode: payment.product.code,
              amount: payment.amount,
              points: payment.points,
              source: 'ops_reconcile_script',
              providerPaymentId: providerId,
            },
          },
        });
      }

      return { alreadyCompleted: false, payment };
    });

    if (result.alreadyCompleted) {
      console.log(`支付 ${paymentId} 已是 completed，未重复发放权益。`);
    } else {
      console.log(`支付 ${paymentId} 已补偿完成。`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('reconcile-payment failed:', err?.message || err);
  process.exit(1);
});
