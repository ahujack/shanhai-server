import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/** 需在 RequireAuthGuard 之后使用，校验当前用户 role === admin */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const uid = req.user?.sub ?? req.user?.id;
    if (!uid) {
      throw new ForbiddenException('需要管理员权限');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: String(uid) },
      select: { role: true },
    });
    if (user?.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return true;
  }
}
