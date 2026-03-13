import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
export declare class AgentController {
    private readonly agentService;
    constructor(agentService: AgentService);
    chat(dto: AgentChatDto): Promise<{
        persona: import("../persona/persona.service").PersonaId;
        intent: "fortune" | "chat" | "divination" | "meditation" | "chart" | "zi";
        reply: string;
        actions: {
            type: string;
            label: string;
        }[];
        artifacts: Record<string, unknown>;
        hasChart: boolean;
    }>;
}
