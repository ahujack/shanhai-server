import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null;

  constructor() {
    this.initResend();
  }

  private getConfig(key: string): string | undefined {
    return process.env[key];
  }

  private initResend() {
    const resendKey = this.getConfig('RESEND_API_KEY');

    // 如果没有配置 RESEND_API_KEY，则使用模拟模式
    if (!resendKey) {
      this.logger.warn('RESEND_API_KEY 未配置，邮件功能将在模拟模式下运行');
      this.resend = null;
      return;
    }

    this.resend = new Resend(resendKey);
    this.logger.log('Resend 邮件服务已初始化');
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const appName = this.getConfig('APP_NAME') || '山海灵境';

    this.logger.log(`准备发送验证码到 ${email}, resend: ${this.resend ? '已配置' : '未配置'}`);

    // 如果没有配置 RESEND，返回模拟结果
    if (!this.resend) {
      this.logger.log(`[模拟] 发送验证码 ${code} 到 ${email}`);
      return true;
    }

    try {
      const data = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: `【${appName}】您的验证码`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px;">
              <h1 style="color: #fff; margin: 0 0 20px 0; font-size: 24px;">${appName}</h1>
              <div style="background: #fff; padding: 30px; border-radius: 8px;">
                <p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">您好，您的验证码是：</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #666; font-size: 14px; margin: 0;">验证码有效期为 5 分钟，请尽快完成验证。</p>
                <p style="color: #999; font-size: 12px; margin: 20px 0 0 0;">如果这不是您的操作，请忽略此邮件。</p>
              </div>
            </div>
          </div>
        `,
      });

      this.logger.log(`验证码已发送到 ${email}, resend id: ${data.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`发送验证码失败: ${error.message}`);
      throw new Error(`邮件发送失败: ${error.message}`);
    }
  }

  /**
   * 发送欢迎邮件
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const appName = this.getConfig('APP_NAME') || '山海灵境';

    if (!this.resend) {
      this.logger.log(`[模拟] 发送欢迎邮件到 ${email}`);
      return true;
    }

    try {
      await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: `欢迎来到${appName}，开启您的命运探索之旅`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px;">
              <h1 style="color: #fff; margin: 0 0 20px 0; font-size: 24px;">欢迎来到 ${appName}!</h1>
              <div style="background: #fff; padding: 30px; border-radius: 8px;">
                <p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">亲爱的 ${name}，</p>
                <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                  感谢您加入${appName}！在这里，您可以：
                </p>
                <ul style="color: #666; font-size: 14px; line-height: 1.8; margin: 0 0 20px 0;">
                  <li>探索您的命理八字</li>
                  <li>获取个性化的运势指引</li>
                  <li>体验冥想放松身心</li>
                </ul>
                <p style="color: #666; font-size: 14px; margin: 0;">
                  祝您旅途愉快！ 🌟
                </p>
              </div>
            </div>
          </div>
        `,
      });

      return true;
    } catch (error) {
      this.logger.error(`发送欢迎邮件失败: ${error.message}`);
      return false;
    }
  }
}
