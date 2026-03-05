import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import { MailService } from '../mail/mail.service';
import type { CreateUserDto, UserProfile } from './user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => JwtService)) private readonly jwtService?: JwtService,
    @Inject(forwardRef(() => MailService)) private readonly mailService?: MailService,
  ) {}

  // 发送验证码
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Body() dto: { email?: string; purpose?: string }) {
    const { email, purpose } = dto;
    
    if (!email) {
      return { success: false, message: '请提供邮箱地址' };
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: '请输入有效的邮箱地址' };
    }

    // 注册时检查邮箱是否已存在
    if (purpose === 'register') {
      if (this.userService.isEmailRegistered(email)) {
        return { success: false, message: '该邮箱已注册' };
      }
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储验证码（5分钟有效）
    this.userService.storeCode(email, code);

    // 发送邮箱验证码
    if (this.mailService) {
      const sent = await this.mailService.sendVerificationCode(email, code);
      if (!sent) {
        return { success: false, message: '发送失败，请稍后重试' };
      }
    } else {
      // 模拟模式：打印到控制台
      console.log(`验证码: ${code} (${email})`);
    }

    return {
      success: true,
      message: '验证码已发送到您的邮箱',
      // 始终返回验证码方便测试
      code: code
    };
  }

  // 注册
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() dto: { email: string; password: string; code: string; name?: string }) {
    const { email, password, code, name } = dto;
    
    if (!email || !password || !code) {
      return { success: false, message: '请提供邮箱、密码和验证码' };
    }

    // 验证密码长度
    if (password.length < 6) {
      return { success: false, message: '密码至少需要6位' };
    }

    // 验证验证码
    const isValid = this.userService.verifyCode(email, code);
    if (!isValid) {
      return { success: false, message: '验证码错误或已过期' };
    }

    // 检查邮箱是否已注册
    if (this.userService.isEmailRegistered(email)) {
      return { success: false, message: '该邮箱已注册' };
    }

    // 创建用户
    const user = this.userService.registerWithEmail(email, password, name || email.split('@')[0]);

    // 生成 JWT Token
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService
      ? this.jwtService.sign(payload)
      : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

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
  async login(@Body() dto: { email: string; password?: string; code?: string }) {
    const { email, password, code } = dto;
    
    if (!email) {
      return { success: false, message: '请提供邮箱' };
    }

    // 优先使用密码登录
    if (password && password.length > 0) {
      const loggedInUser = this.userService.loginWithPassword(email, password);
      if (!loggedInUser) {
        return { success: false, message: '邮箱或密码错误' };
      }

      // 生成 JWT Token
      const payload = { sub: loggedInUser.id, email: loggedInUser.email };
      const token = this.jwtService
        ? this.jwtService.sign(payload)
        : Buffer.from(`${loggedInUser.id}:${Date.now()}`).toString('base64');

      return {
        success: true,
        token,
        user: {
          id: loggedInUser.id,
          name: loggedInUser.name,
          email: loggedInUser.email,
          role: loggedInUser.role,
          membership: loggedInUser.membership,
        }
      };
    } else if (code && code.length > 0) {
      // 验证码登录
      const isValid = this.userService.verifyCode(email, code);
      if (!isValid) {
        return { success: false, message: '验证码错误或已过期' };
      }
      // 验证码登录时自动创建用户（如果不存在）
      const user = this.userService.findOrCreateByEmail(email);

      // 生成 JWT Token
      const payload = { sub: user.id, email: user.email };
      const token = this.jwtService
        ? this.jwtService.sign(payload)
        : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

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
  async socialLogin(@Body() dto: { provider: 'google' | 'facebook'; idToken: string }) {
    let userInfo: { email?: string; name?: string } | null = null;

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

    // 创建或更新用户
    const user = this.userService.findOrCreateBySocial(dto.provider, dto.idToken, userInfo);

    // 生成 JWT Token
    const payload = { sub: user.id, email: user.email, provider: dto.provider };
    const token = this.jwtService
      ? this.jwtService.sign(payload)
      : Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

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
  private async verifyGoogleToken(idToken: string): Promise<{ email?: string; name?: string } | null> {
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
        };
      }

      console.log(`[模拟] 验证 Google ID Token: ${idToken.substring(0, 20)}...`);
      return {
        email: `user_${Date.now()}@example.com`,
        name: 'Google User',
      };
    } catch (error) {
      console.error('Google Token 验证失败:', error.message);
      return null;
    }
  }

  // 验证 Facebook Access Token
  private async verifyFacebookToken(accessToken: string): Promise<{ email?: string; name?: string } | null> {
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

        const userInfoUrl = `https://graph.facebook.com/v18.0/me?fields=email,name&access_token=${accessToken}`;
        const userResponse = await axios.get(userInfoUrl);
        
        return {
          email: userResponse.data.email,
          name: userResponse.data.name,
        };
      }

      console.log(`[模拟] 验证 Facebook Access Token: ${accessToken.substring(0, 20)}...`);
      return {
        email: `user_${Date.now()}@example.com`,
        name: 'Facebook User',
      };
    } catch (error) {
      console.error('Facebook Token 验证失败:', error.message);
      return null;
    }
  }

  // 刷新 Token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: { token: string }) {
    try {
      let userId: string;

      if (this.jwtService) {
        const payload = this.jwtService.verify(dto.token);
        userId = payload.sub;
      } else {
        const decoded = Buffer.from(dto.token, 'base64').toString();
        [userId] = decoded.split(':');
      }

      const user = this.userService.findOne(userId);

      const payload = { sub: user.id, email: user.email };
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
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
