import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
export declare class AgentController {
    private readonly agentService;
    constructor(agentService: AgentService);
    chat(dto: AgentChatDto): Promise<{
        persona: import("../persona/persona.service").PersonaId;
        intent: "zi" | "chat" | "divination" | "meditation" | "chart" | "fortune";
        reply: string;
        actions: any[];
        artifacts: Record<string, unknown>;
        hasChart: boolean;
    }>;
}
