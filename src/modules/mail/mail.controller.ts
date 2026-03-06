
import { Controller, Get } from '@nestjs/common';

@Controller('debug')
export class DebugController {
  @Get('smtp-status')
  getSmtpStatus() {
    return {
      SMTP_HOST: process.env.SMTP_HOST || 'undefined',
      SMTP_PORT: process.env.SMTP_PORT || 'undefined',
      SMTP_USER: process.env.SMTP_USER || 'undefined',
      SMTP_PASS: process.env.SMTP_PASS ? '已设置' : 'undefined',
    };
  }
}
