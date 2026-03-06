const nodemailer = require('nodemailer');

async function testGmail() {
  const host = 'smtp.gmail.com';
  const port = 587;  // 改用 TLS 端口
  const user = 'ahujack52@gmail.com';
  const pass = 'vxfd mblw xkpd rvwf';

  console.log('测试 Gmail SMTP (端口 587 TLS)...');
  console.log(`Host: ${host}, Port: ${port}, User: ${user}`);

  const transporter = nodemailer.createTransport({
    host: host,  // 使用域名，不要用解析后的 IP
    port: port,
    secure: false,  // 587 需要 STARTTLS
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 60000,
    socketTimeout: 60000,
  });

  try {
    console.log('尝试发送邮件...');
    await transporter.sendMail({
      from: `"山海灵境" <${user}>`,
      to: user,
      subject: '测试邮件',
      html: '<h1>测试成功！</h1>',
    });
    console.log('✅ 邮件发送成功！');
  } catch (error) {
    console.error('❌ 邮件发送失败:', error.message);
  }
}

testGmail();
