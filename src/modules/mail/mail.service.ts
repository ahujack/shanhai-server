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

  private getFromAddress(): string {
    const from = this.getConfig('RESEND_FROM') || this.getConfig('MAIL_FROM');
    return (from && from.trim()) || 'onboarding@resend.dev';
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const appName = this.getConfig('APP_NAME') || '山海灵境';
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const fromAddress = this.getFromAddress();

    this.logger.log(`准备发送验证码到 ${email}, resend: ${this.resend ? '已配置' : '未配置'}`);

    // 生产环境必须真实发信；开发环境允许模拟
    if (!this.resend) {
      if (isProd) {
        this.logger.error('生产环境未配置 RESEND_API_KEY，无法发送验证码邮件');
        return false;
      }
      this.logger.log(`[模拟] 发送验证码 ${code} 到 ${email}`);
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: fromAddress,
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

      const resendError = (result as { error?: { message?: string } | null } | null)?.error;
      if (resendError) {
        const msg = resendError.message || 'Resend 返回错误';
        this.logger.error(`验证码发送被 Resend 拒绝: ${msg}`);
        throw new Error(`邮件发送失败: ${msg}`);
      }

      this.logger.log(`验证码已发送到 ${email}, resend id: ${(result as { data?: { id?: string } | null } | null)?.data?.id || 'unknown'}`);
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
    const fromAddress = this.getFromAddress();

    if (!this.resend) {
      this.logger.log(`[模拟] 发送欢迎邮件到 ${email}`);
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: fromAddress,
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

      const resendError = (result as { error?: { message?: string } | null } | null)?.error;
      if (resendError) {
        this.logger.error(`欢迎邮件发送被 Resend 拒绝: ${resendError.message || 'unknown error'}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`发送欢迎邮件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    const appName = this.getConfig('APP_NAME') || '山海灵境';
    const fromAddress = this.getFromAddress();

    if (!this.resend) {
      this.logger.log(`[模拟] 发送密码重置邮件到 ${email}, 验证码: ${code}`);
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: fromAddress,
        to: email,
        subject: `【${appName}】密码重置验证码`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px;">
              <h1 style="color: #fff; margin: 0 0 20px 0; font-size: 24px;">${appName} - 密码重置</h1>
              <div style="background: #fff; padding: 30px; border-radius: 8px;">
                <p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">您好，</p>
                <p style="color: #666; font-size: 14px; margin: 0 0 20px 0;">
                  您正在进行密码重置操作。请使用以下验证码完成验证：
                </p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #666; font-size: 14px; margin: 0;">验证码有效期为 5 分钟，请尽快完成操作。</p>
                <p style="color: #999; font-size: 12px; margin: 20px 0 0 0;">如果这不是您的操作，请忽略此邮件，您的账户安全不会受到影响。</p>
              </div>
            </div>
          </div>
        `,
      });

      const resendError = (result as { error?: { message?: string } | null } | null)?.error;
      if (resendError) {
        this.logger.error(`重置密码邮件发送被 Resend 拒绝: ${resendError.message || 'unknown error'}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`发送密码重置邮件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 把这一次解读摘要发到用户邮箱。不承诺日报，只寄当前这一封。
   */
  async sendReadingSnapshot(input: {
    email: string;
    source: string;
    headline?: string;
    summary?: string;
    tip?: string;
    ctaUrl: string;
  }): Promise<boolean> {
    const appName = this.getConfig('APP_NAME') || '山海灵境';
    const fromAddress = this.getFromAddress();
    const headline = this.escapeHtml(String(input.headline || '这一次的结论').slice(0, 120));
    const summary = this.escapeHtml(String(input.summary || '').slice(0, 400));
    const tip = this.escapeHtml(String(input.tip || '').slice(0, 200));
    const ctaUrl = this.escapeHtml(input.ctaUrl);

    if (!this.resend) {
      const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (isProd) {
        this.logger.error('生产环境未配置 RESEND_API_KEY，无法发送解读摘要');
        return false;
      }
      this.logger.log(`[模拟] 发送解读摘要到 ${input.email} source=${input.source}`);
      return true;
    }

    try {
      const result = await this.resend.emails.send({
        from: fromAddress,
        to: input.email,
        subject: `【${appName}】${String(input.headline || '这一次的结论').slice(0, 40)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; max-width: 560px; margin: 0 auto; background: #0B0D14; color: #EDE4D4;">
            <p style="color: #D6B36A; font-size: 13px; letter-spacing: 2px; margin: 0 0 12px 0;">${appName}</p>
            <p style="color: rgba(214,179,106,0.8); font-size: 13px; font-style: italic; margin: 0 0 20px 0;">不是判决，是下一步的坐标。</p>
            <h1 style="color: #F7F1E6; font-size: 22px; line-height: 1.4; margin: 0 0 16px 0;">${headline}</h1>
            ${summary ? `<p style="color: #C9D0DC; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">${summary}</p>` : ''}
            ${tip ? `<p style="color: #D6B36A; font-size: 15px; line-height: 1.7; margin: 0 0 24px 0;">今日一招：${tip}</p>` : ''}
            <p style="margin: 0 0 28px 0;">
              <a href="${ctaUrl}" style="display: inline-block; background: #D6B36A; color: #17120A; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px;">继续追问这一步</a>
            </p>
            <p style="color: rgba(232,226,212,0.45); font-size: 12px; line-height: 1.6; margin: 0;">
              这是你刚才留下的这一次摘要，不是每日群发运势。仅供娱乐与自我反思。<br/>
              若不想再收到，忽略即可。
            </p>
          </div>
        `,
      });
      const resendError = (result as { error?: { message?: string } | null } | null)?.error;
      if (resendError) {
        this.logger.error(`解读摘要发送被 Resend 拒绝: ${resendError.message || 'unknown error'}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`发送解读摘要失败: ${(error as Error)?.message}`);
      return false;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
