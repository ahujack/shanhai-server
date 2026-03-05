import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthController } from './auth.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [UserController, AuthController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
