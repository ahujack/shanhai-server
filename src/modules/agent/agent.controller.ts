import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() dto: AgentChatDto) {
    return this.agentService.handleChat(dto);
  }

  @Post('chat-stream')
  async chatStream(@Body() dto: AgentChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const event of this.agentService.handleChatStream(dto)) {
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

