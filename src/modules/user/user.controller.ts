import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import type { CreateUserDto } from './user.service';
import { RequireAuthGuard } from '../auth/jwt-auth.guard';

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
  @UseGuards(RequireAuthGuard)
  update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>, @Req() req: { user: { sub?: string; id?: string } }) {
    const authUserId = String(req.user?.sub || req.user?.id || '');
    if (!authUserId || authUserId !== id) {
      throw new BadRequestException('无权修改他人资料');
    }
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
