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
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import type { CreateUserDto } from './user.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminGrantMembershipDto, AdminGrantPointsDto } from './dto/admin-user-ops.dto';

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

  @Post('admin/:id/grant-points')
  @UseGuards(RequireAuthGuard, AdminGuard)
  grantPoints(
    @Param('id') id: string,
    @Body() dto: AdminGrantPointsDto,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    const operatorId = String(req.user?.sub || req.user?.id || '');
    if (!operatorId) {
      throw new BadRequestException('请先登录');
    }
    return this.userService.adminGrantPoints(operatorId, id, dto.points, dto.reason);
  }

  @Post('admin/:id/grant-membership')
  @UseGuards(RequireAuthGuard, AdminGuard)
  grantMembership(
    @Param('id') id: string,
    @Body() dto: AdminGrantMembershipDto,
    @Req() req: { user: { sub?: string; id?: string } },
  ) {
    const operatorId = String(req.user?.sub || req.user?.id || '');
    if (!operatorId) {
      throw new BadRequestException('请先登录');
    }
    return this.userService.adminGrantMembership(operatorId, id, dto.membership, dto.days, dto.reason);
  }

  @Get('admin/:id/points-detail')
  @UseGuards(RequireAuthGuard, AdminGuard)
  getPointsDetail(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit || '100', 10);
    return this.userService.getAdminUserPointsDetail(id, Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('admin/:id/activity-detail')
  @UseGuards(RequireAuthGuard, AdminGuard)
  getActivityDetail(
    @Param('id') id: string,
    @Query('chatLimit') chatLimit?: string,
    @Query('eventLimit') eventLimit?: string,
    @Query('days') days?: string,
    @Query('keyword') keyword?: string,
  ) {
    const parsedChatLimit = Number.parseInt(chatLimit || '40', 10);
    const parsedEventLimit = Number.parseInt(eventLimit || '60', 10);
    const parsedDays = Number.parseInt(days || '30', 10);
    return this.userService.getAdminUserActivityDetail(id, {
      chatLimit: Number.isFinite(parsedChatLimit) ? parsedChatLimit : 40,
      eventLimit: Number.isFinite(parsedEventLimit) ? parsedEventLimit : 60,
      periodDays: Number.isFinite(parsedDays) ? parsedDays : 30,
      keyword: (keyword || '').trim(),
    });
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
