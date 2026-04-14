import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  Inject,
  forwardRef,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { MailService } from '../mail/mail.service';
import type { UserProfile } from '../user/user.service';
import { 
  SendCodeDto, 
  RegisterDto, 
  LoginDto, 
  SocialLoginDto, 
  RefreshTokenDto,
  ResetPasswordDto 
} from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly userService: UserService,
    private readonly analyticsService: AnalyticsService,
    @Inject(forwardRef(() => JwtService)) private readonly jwtService?: JwtService,
    @Inject(forwardRef(() => MailService)) private readonly mailService?: MailService,
  ) {}

  // 发送验证码
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendCode(@Body() dto: SendCodeDto) {
    const { email, purpose } = dto;
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const debugAuth = process.env.DEBUG_AUTH === 'true';

    if (!email) {
      return { success: false, message: '请提供邮箱地址' };
    }

    if (!isProd || debugAuth) {
      this.logger.debug(
        `SMTP: hostSet=${!!process.env.SMTP_HOST} portSet=${!!process.env.SMTP_PORT} userSet=${!!process.env.SMTP_USER} passSet=${!!process.env.SMTP_PASS}`,
      );
    }

    // 注册时检查邮箱是否已存在
    if (purpose === 'register') {
      if (await this.userService.isEmailRegistered(email)) {
        return { success: false, message: '该邮箱已注册' };
      }
    }

    // 重置密码时检查邮箱是否存在
    if (purpose === 'reset') {
      if (!await this.userService.isEmailRegistered(email)) {
        return { success: false, message: '该邮箱未注册' };
      }
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 发送邮箱验证码
    let sent = false;
    let errorMessage = '';
    if (this.mailService) {
      try {
        sent = await this.mailService.sendVerificationCode(email, code);
      } catch (error) {
        errorMessage = error.message;
      }
    }
    
    if (!this.mailService || !sent) {
      if (!isProd) {
        this.logger.warn(`验证码未通过邮件发出（仅开发环境会在响应中返回 code）`);
        return {
          success: false,
          message: errorMessage || '邮件发送失败',
          code,
        };
      }
      this.logger.warn(`邮件发送失败: purpose=${purpose}`);
      return {
        success: false,
        message: errorMessage || '邮件发送失败，请稍后重试',
      };
    }

    // 仅在发送成功后存储验证码（5分钟有效）
    await this.userService.storeCode(email, code, purpose || 'login');

    return {
      success: true,
      message: '验证码已发送到您的邮箱',
    };
  }

  // 注册
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const { email, password, code, name, referralCode } = dto;
    
    // 验证密码长度
    if (password.length < 6) {
      return { success: false, message: '密码至少需要6位' };
    }

    // 验证验证码
    const verifyRes = await this.userService.verifyCode(email, code, 'register');
    if (!verifyRes.ok) {
      if (verifyRes.reason === 'locked') {
        return { success: false, message: `验证码输入错误次数过多，请 ${verifyRes.retryAfterSec || 600} 秒后重试` };
      }
      return { success: false, message: '验证码错误或已过期' };
    }

    // 检查邮箱是否已注册
    if (await this.userService.isEmailRegistered(email)) {
      return { success: false, message: '该邮箱已注册' };
    }

    // 创建用户（带推荐码）
    const user = await this.userService.registerWithEmail(email, password, name, referralCode);

    // 生成 JWT Token
    const payload = { sub: user.id, id: user.id, email: user.email };
    const token = this.jwtService
      ? this.jwtService.sign(payload)
      : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    try {
      void this.analyticsService.recordFromRequest(req, {
        userId: user.id,
        name: 'register',
        props: { referral: !!referralCode },
      });
    } catch {
      /* 埋点失败不影响注册 */
    }

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
      }
    };
  }

  // 密码登录
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const { email, password, code } = dto;
    
    if (!email) {
      return { success: false, message: '请提供邮箱' };
    }

    // 优先使用密码登录
    if (password && password.length > 0) {
      const loggedInUser = await this.userService.loginWithPassword(email, password);
      if (!loggedInUser) {
        return { success: false, message: '邮箱或密码错误' };
      }

      // 生成 JWT Token
      const user: UserProfile = loggedInUser;
      const payload = { sub: user.id, id: user.id, email: user.email };
      const token = this.jwtService
        ? this.jwtService.sign(payload)
        : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      try {
        void this.analyticsService.recordFromRequest(req, {
          userId: user.id,
          name: 'login',
          props: { method: 'password' },
        });
      } catch {
        /* ignore */
      }

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          membership: user.membership,
        }
      };
    } else if (code && code.length > 0) {
      // 验证码登录
      const verifyRes = await this.userService.verifyCode(email, code, 'login');
      if (!verifyRes.ok) {
        if (verifyRes.reason === 'locked') {
          return { success: false, message: `验证码输入错误次数过多，请 ${verifyRes.retryAfterSec || 600} 秒后重试` };
        }
        return { success: false, message: '验证码错误或已过期' };
      }
      // 验证码登录时自动创建用户（如果不存在）
      const user = await this.userService.findOrCreateByEmail(email);

      // 生成 JWT Token
      const payload = { sub: user.id, id: user.id, email: user.email };
      const token = this.jwtService
        ? this.jwtService.sign(payload)
        : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      try {
        void this.analyticsService.recordFromRequest(req, {
          userId: user.id,
          name: 'login',
          props: { method: 'code' },
        });
      } catch {
        /* ignore */
      }

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          membership: user.membership,
        }
      };
    } else {
      return { success: false, message: '请提供密码或验证码' };
    }
  }

  // 第三方登录（谷歌/Facebook）
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(@Body() dto: SocialLoginDto, @Req() req: Request) {
    let userInfo: { email?: string; name?: string; sub?: string } | null = null;

    if (dto.provider === 'google') {
      userInfo = await this.verifyGoogleToken(dto.idToken);
    } else if (dto.provider === 'facebook') {
      userInfo = await this.verifyFacebookToken(dto.idToken);
    } else {
      return { success: false, message: '不支持的登录方式' };
    }

    if (!userInfo) {
      return { success: false, message: '第三方登录验证失败' };
    }

    const socialId = userInfo.sub?.trim();
    if (!socialId) {
      return { success: false, message: '无法解析第三方账号标识，请更新应用后重试' };
    }

    // 创建或更新用户（传入原始 token 以匹配历史误将整段 token 写入 googleId/facebookId 的数据）
    const user = await this.userService.findOrCreateBySocial(
      dto.provider,
      socialId,
      userInfo,
      dto.idToken,
      dto.referralCode,
    );

    // 生成 JWT Token
    const payload = { sub: user.id, id: user.id, email: user.email, provider: dto.provider };
    const token = this.jwtService
      ? this.jwtService.sign(payload)
      : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    try {
      void this.analyticsService.recordFromRequest(req, {
        userId: user.id,
        name: 'login',
        props: { method: 'social', provider: dto.provider },
      });
    } catch {
      /* ignore */
    }

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
        avatar: user.avatar,
      }
    };
  }

  // 验证 Google ID Token
  private async verifyGoogleToken(
    idToken: string,
  ): Promise<{ email?: string; name?: string; sub?: string } | null> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (clientId) {
        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        return {
          email: payload?.email,
          name: payload?.name,
          sub: payload?.sub,
        };
      }

      if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
        this.logger.error('GOOGLE_CLIENT_ID 未配置，拒绝 Google 登录');
        return null;
      }
      this.logger.debug('Google ID Token 使用开发模拟验证');
      return {
        email: 'dev_google@shanhai.local',
        name: 'Google User',
        sub: 'mock_google_sub_stable',
      };
    } catch (error) {
      this.logger.warn(`Google Token 验证失败: ${(error as Error).message}`);
      return null;
    }
  }

  // 验证 Facebook Access Token
  private async verifyFacebookToken(
    accessToken: string,
  ): Promise<{ email?: string; name?: string; sub?: string } | null> {
    try {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (appId && appSecret) {
        const { default: axios } = await import('axios');
        const debugTokenUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
        const debugResponse = await axios.get(debugTokenUrl);
        
        if (!debugResponse.data.data.is_valid) {
          return null;
        }

        const userInfoUrl = `https://graph.facebook.com/v18.0/me?fields=id,email,name&access_token=${accessToken}`;
        const userResponse = await axios.get(userInfoUrl);
        
        return {
          email: userResponse.data.email,
          name: userResponse.data.name,
          sub: userResponse.data.id != null ? String(userResponse.data.id) : undefined,
        };
      }

      if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
        this.logger.error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET 未配置，拒绝 Facebook 登录');
        return null;
      }
      this.logger.debug('Facebook Access Token 使用开发模拟验证');
      return {
        email: 'dev_facebook@shanhai.local',
        name: 'Facebook User',
        sub: 'mock_facebook_sub_stable',
      };
    } catch (error) {
      this.logger.warn(`Facebook Token 验证失败: ${(error as Error).message}`);
      return null;
    }
  }

  // 刷新 Token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      let userId: string;

      if (this.jwtService) {
        const payload = this.jwtService.verify(dto.token);
        userId = payload.sub;
      } else {
        const decoded = Buffer.from(dto.token, 'base64').toString();
        [userId] = decoded.split(':');
      }

      const user = await this.userService.findOne(userId);

      const payload = { sub: user.id, id: user.id, email: user.email };
      const newToken = this.jwtService
        ? this.jwtService.sign(payload)
        : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

      return { success: true, token: newToken };
    } catch {
      return { success: false, message: 'Token 无效' };
    }
  }

  // 登出
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { success: true, message: '已登出' };
  }

  // 重置密码
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const { email, code, newPassword } = dto;

    // 验证新密码长度
    if (newPassword.length < 6) {
      return { success: false, message: '密码至少需要6位' };
    }

    // 验证验证码
    const verifyRes = await this.userService.verifyCode(email, code, 'reset');
    if (!verifyRes.ok) {
      if (verifyRes.reason === 'locked') {
        return { success: false, message: `验证码输入错误次数过多，请 ${verifyRes.retryAfterSec || 600} 秒后重试` };
      }
      return { success: false, message: '验证码错误或已过期' };
    }

    // 检查用户是否存在
    if (!await this.userService.isEmailRegistered(email)) {
      return { success: false, message: '该邮箱未注册' };
    }

    // 更新密码
    try {
      await this.userService.resetPassword(email, newPassword);
      return { success: true, message: '密码重置成功' };
    } catch (error) {
      return { success: false, message: '密码重置失败' };
    }
  }

  // 调试端点：检查 SMTP 配置（生产默认关闭）
  @Get('debug/smtp')
  debugSmtp() {
    const env = (process.env.NODE_ENV || '').toLowerCase();
    const allow = env !== 'production' || process.env.ENABLE_AUTH_DEBUG === 'true';
    if (!allow) {
      throw new NotFoundException();
    }
    return {
      SMTP_HOST: process.env.SMTP_HOST || 'undefined',
      SMTP_PORT: process.env.SMTP_PORT || 'undefined',
      SMTP_USER: process.env.SMTP_USER || 'undefined',
      SMTP_PASS: process.env.SMTP_PASS ? '已设置' : 'undefined',
    };
  }
}
