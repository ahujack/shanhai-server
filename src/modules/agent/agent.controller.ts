import { Body, Controller, Post, Res, Req, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(@Body() dto: AgentChatDto, @Req() req: { user?: { sub?: string; id?: string } }) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.agentService.handleChat({ ...dto, userId });
  }

  @Post('chat-stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(@Body() dto: AgentChatDto, @Res() res: Response, @Req() req: { user?: { sub?: string; id?: string } }) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const userId = req.user?.sub ?? req.user?.id;
    try {
      for await (const event of this.agentService.handleChatStream({ ...dto, userId })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`);
    }
    res.end();
  }
}

