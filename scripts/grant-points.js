/**
 * 运维脚本：按用户名或邮箱增加积分，可选修正邮箱。
 *
 * 在 shanhai-server 目录执行，需配置 DATABASE_URL（如 Railway：`railway run node scripts/grant-points.js ...`）。
 *
 * 示例：
 *   node scripts/grant-points.js --name ahujack52 --points 500
 *   node scripts/grant-points.js --email old@example.com --points 200 --set-email new@gmail.com
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
  const points = parseInt(String(args.points || '0'), 10);
  const name = args.name ? String(args.name).trim() : '';
  const email = args.email ? String(args.email).trim() : '';
  const setEmail = args['set-email'] ? String(args['set-email']).trim() : '';

  if (!process.env.DATABASE_URL) {
    console.error('缺少 DATABASE_URL，无法连接数据库');
    process.exit(1);
  }
  if (!Number.isFinite(points) || points <= 0) {
    console.error('请指定正整数 --points');
    process.exit(1);
  }
  if (!name && !email) {
    console.error('请指定 --name 或 --email');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    let user = null;
    if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user && name) {
      user = await prisma.user.findFirst({ where: { name } });
    }

    if (!user) {
      console.error('未找到用户（请检查 name / email）');
      process.exit(1);
    }

    if (setEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setEmail)) {
        console.error('--set-email 格式无效');
        process.exit(1);
      }
      const taken = await prisma.user.findFirst({
        where: { email: setEmail, id: { not: user.id } },
      });
      if (taken) {
        console.error('目标邮箱已被其他账号占用');
        process.exit(1);
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email: setEmail },
      });
      console.log('已更新邮箱为', setEmail);
    }

    await prisma.$transaction(async (tx) => {
      let row = await tx.userPoints.findUnique({ where: { userId: user.id } });
      if (!row) {
        await tx.userPoints.create({
          data: {
            userId: user.id,
            totalPoints: points,
            availablePoints: points,
          },
        });
      } else {
        await tx.userPoints.update({
          where: { userId: user.id },
          data: {
            totalPoints: { increment: points },
            availablePoints: { increment: points },
          },
        });
      }
      await tx.pointRecord.create({
        data: {
          userId: user.id,
          points,
          type: 'bonus',
          description: args.reason ? String(args.reason) : '运维手动发放（grant-points 脚本）',
        },
      });
    });

    const summary = await prisma.userPoints.findUnique({ where: { userId: user.id } });
    console.log('完成。用户:', user.name, user.email);
    console.log('当前可用积分:', summary?.availablePoints ?? 0, '总积分:', summary?.totalPoints ?? 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
