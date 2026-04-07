import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import type { CreateUserDto } from './user.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 游客完善资料（无 token）；需全局限流防刷号 */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  /** 当前登录用户资料（推荐前端优先使用，避免传 id） */
  @Get('me')
  @UseGuards(RequireAuthGuard)
  me(@Req() req: { user: { sub?: string; id?: string } }) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    return this.userService.findOne(authUserId);
  }

  @Get()
  @UseGuards(RequireAuthGuard, AdminGuard)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(RequireAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: { user: { sub?: string; id?: string } }) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    if (authUserId !== id) {
      await this.userService.requireAdmin(authUserId);
    }
    return this.userService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RequireAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateUserDto>,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId || authUserId !== id) {
      throw new BadRequestException('无权修改他人资料');
    }
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RequireAuthGuard)
  async delete(@Param('id') id: string, @Req() req: { user: { sub?: string; id?: string } }) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId) {
      throw new BadRequestException('请先登录');
    }
    if (authUserId !== id) {
      await this.userService.requireAdmin(authUserId);
    }
    return this.userService.delete(id);
  }
}
