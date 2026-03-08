// 修复脚本 - 直接使用 process.env.DATABASE_URL
const { PrismaClient } = require('@prisma/client');

// 直接从环境变量创建 PrismaClient
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function fixMigration() {
  console.log('=== 开始修复迁移 ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');
  
  try {
    // 1. 检查并添加 referredBy 列
    console.log('1. 检查 referredBy 列...');
    try {
      await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN "referredBy" TEXT`;
      console.log('   referredBy 列已添加');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   referredBy 列已存在');
      } else {
        console.log('   referredBy 列添加结果:', e.message.substring(0, 100));
      }
    }
    
    // 2. 检查并添加 referralCode 列
    console.log('2. 检查 referralCode 列...');
    try {
      await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN "referralCode" TEXT`;
      console.log('   referralCode 列已添加');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   referralCode 列已存在');
      } else {
        console.log('   referralCode 列添加结果:', e.message.substring(0, 100));
      }
    }
    
    // 3. 创建唯一索引
    console.log('3. 创建唯一索引...');
    try {
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" 
        ON "User"("referralCode") WHERE "referralCode" IS NOT NULL
      `;
      console.log('   索引已创建');
    } catch (e) {
      console.log('   索引创建结果:', e.message.substring(0, 100));
    }
    
    // 4. 为现有用户生成 referral code
    console.log('4. 为现有用户生成 referral code...');
    try {
      await prisma.$executeRaw`
        UPDATE "User" SET "referralCode" = substr(md5(random()::text), 1, 8) 
        WHERE "referralCode" IS NULL
      `;
      console.log('   referral code 已生成');
    } catch (e) {
      console.log('   生成 referral code 结果:', e.message.substring(0, 100));
    }
    
    // 5. 标记迁移为成功
    console.log('5. 标记迁移为成功...');
    try {
      await prisma.$queryRaw`
        UPDATE _prisma_migrations 
        SET finished_at = NOW(), 
            rolled_back_at = NULL,
            applied_steps_count = 1
        WHERE migration_name = '20240308_add_referral_system'
          AND rolled_back_at IS NOT NULL
      `;
      console.log('   迁移已标记为成功');
    } catch (e) {
      console.log('   标记迁移结果:', e.message.substring(0, 100));
    }
    
    console.log('=== 修复完成 ===');
    
  } catch (error) {
    console.error('修复过程中出错:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration();
