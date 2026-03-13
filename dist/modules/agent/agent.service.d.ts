import { PersonaService } from '../persona/persona.service';
import { ReadingService } from '../reading/reading.service';
import { FortuneService } from '../fortune/fortune.service';
import { ChartService } from '../chart/chart.service';
import { AgentChatDto } from './dto/agent-chat.dto';
type AgentIntent = 'chat' | 'divination' | 'meditation' | 'chart' | 'fortune' | 'zi';
export declare class AgentService {
    private readonly personaService;
    private readonly readingService;
    private readonly fortuneService;
    private readonly chartService;
    private readonly logger;
    private prisma;
    constructor(personaService: PersonaService, readingService: ReadingService, fortuneService: FortuneService, chartService: ChartService);
    handleChat(dto: AgentChatDto): Promise<{
        persona: import("../persona/persona.service").PersonaId;
        intent: AgentIntent;
        reply: string;
        actions: {
            type: string;
            label: string;
        }[];
        artifacts: Record<string, unknown>;
        hasChart: boolean;
    }>;
    private extractZiFromMessage;
    private classifyWithDeepSeek;
    private fallbackDetectIntent;
    private inferCategory;
    private resolvePersona;
    private buildMeditation;
    private generateAIReply;
    private getDefaultChatReply;
    private composeReply;
}
export {};
