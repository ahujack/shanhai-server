// 临时修复脚本 - 修复失败的迁移并手动执行SQL
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMigration() {
  console.log('=== 开始修复迁移 ===');
  
  try {
    // 1. 检查并修复失败的迁移记录
    console.log('1. 检查迁移状态...');
    const migrations = await prisma.$queryRaw`
      SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5
    `;
    console.log('当前迁移状态:', JSON.stringify(migrations, null, 2));
    
    // 2. 检查 referralCode 列是否存在
    console.log('2. 检查 referralCode 列...');
    try {
      const columnCheck = await prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'referralCode'
      `;
      
      if (Array.isArray(columnCheck) && columnCheck.length === 0) {
        console.log('3. 添加 referralCode 列...');
        await prisma.$executeRaw`
          ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
        `;
        console.log('   referralCode 列已添加');
        
        await prisma.$executeRaw`
          ALTER TABLE "User" ADD COLUMN "referredBy" TEXT;
        `;
        console.log('   referredBy 列已添加');
      } else {
        console.log('   列已存在，跳过');
      }
    } catch (e) {
      console.log('   列可能已存在:', e.message);
    }
    
    // 3. 创建唯一索引
    console.log('4. 创建唯一索引...');
    try {
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" 
        ON "User"("referralCode") WHERE "referralCode" IS NOT NULL
      `;
      console.log('   索引已创建');
    } catch (e) {
      console.log('   索引可能已存在:', e.message);
    }
    
    // 4. 为现有用户生成 referral code
    console.log('5. 为现有用户生成 referral code...');
    try {
      const result = await prisma.$executeRaw`
        UPDATE "User" SET "referralCode" = substr(md5(random()::text), 1, 8) 
        WHERE "referralCode" IS NULL
      `;
      console.log(`   已为 ${result} 个用户生成 referral code`);
    } catch (e) {
      console.log('   生成 referral code 时出错:', e.message);
    }
    
    // 5. 标记迁移为成功
    console.log('6. 标记迁移为成功...');
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
      console.log('   标记迁移时出错(可能不需要):', e.message);
    }
    
    console.log('=== 修复完成 ===');
    
  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration();
