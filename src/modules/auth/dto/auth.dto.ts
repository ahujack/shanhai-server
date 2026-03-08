import { IsEmail, IsString, MinLength, IsOptional, IsIn, Matches } from 'class-validator';

export class SendCodeDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsIn(['login', 'register', 'reset'])
  purpose?: 'login' | 'register' | 'reset';
}

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码至少需要6位' })
  password: string;

  @IsString({ message: '验证码必须是字符串' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  code: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  referralCode?: string; // 推荐码
}

export class LoginDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少需要6位' })
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  code?: string;
}

export class SocialLoginDto {
  @IsIn(['google', 'facebook'], { message: '不支持的登录方式' })
  provider: 'google' | 'facebook';

  @IsString({ message: 'ID Token 必须是字符串' })
  idToken: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'Token 必须是字符串' })
  token: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString({ message: '验证码必须是字符串' })
  @Matches(/^\d{6}$/, { message: '验证码必须是6位数字' })
  code: string;

  @IsString({ message: '新密码必须是字符串' })
  @MinLength(6, { message: '新密码至少需要6位' })
  newPassword: string;
}
