const nodemailer = require('nodemailer');

async function testQQEmail() {
  // 直接使用之前成功的配置
  console.log('=== 测试 QQ 邮箱 SMTP (直接配置) ===');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: 'ahujack52@qq.com',
      pass: 'mcppimxxaeslbaeg',
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 30000,
    socketTimeout: 30000,
  });

  try {
    await transporter.sendMail({
      from: '"山海灵境" <ahujack52@qq.com>',
      to: 'ahujack52@gmail.com',
      subject: '测试验证码',
      html: '<h1>您的验证码是：123456</h1><p>5分钟内有效</p>',
    });
    console.log('✅ 发送成功！');
  } catch (error) {
    console.log('❌ 失败:', error.message);
  }
}

testQQEmail();
