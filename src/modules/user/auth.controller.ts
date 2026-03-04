import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UserService, CreateUserDto } from './user.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  // 发送验证码
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  sendCode(@Body() dto: { phone?: string; email?: string }) {
    const identifier = dto.phone || dto.email;
    if (!identifier) {
      return { success: false, message: '请提供手机号或邮箱' };
    }
    
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 存储验证码（5分钟有效）
    this.userService.storeCode(identifier, code);
    
    // TODO: 实际发送短信/邮箱
    console.log(`验证码: ${code} (${identifier})`);
    
    return { 
      success: true, 
      message: '验证码已发送',
      // 测试环境直接返回验证码
      code: process.env.NODE_ENV === 'production' ? undefined : code
    };
  }

  // 手机号/邮箱登录
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: { phone?: string; email?: string; code: string }) {
    const identifier = dto.phone || dto.email;
    if (!identifier || !dto.code) {
      return { success: false, message: '请提供手机号/邮箱和验证码' };
    }
    
    // 验证验证码
    const isValid = this.userService.verifyCode(identifier, dto.code);
    if (!isValid) {
      return { success: false, message: '验证码错误或已过期' };
    }
    
    // 创建或获取用户
    const user = this.userService.findOrCreateByIdentifier(identifier);
    
    // 生成简单的 token（生产环境应使用 JWT）
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        membership: user.membership,
      }
    };
  }

  // 第三方登录（谷歌/Facebook）
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  socialLogin(@Body() dto: { provider: 'google' | 'facebook'; idToken: string }) {
    // TODO: 验证 Google/Facebook ID Token
    // 这里简化处理，实际需要验证 idToken
    
    // 模拟解析 ID Token
    const mockUserId = `social_${dto.provider}_${Date.now()}`;
    const user = this.userService.findOrCreateBySocial(dto.provider, mockUserId);
    
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        membership: user.membership,
      }
    };
  }

  // 刷新 Token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: { token: string }) {
    try {
      const decoded = Buffer.from(dto.token, 'base64').toString();
      const [userId] = decoded.split(':');
      
      const user = this.userService.findOne(userId);
      const newToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
      
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
