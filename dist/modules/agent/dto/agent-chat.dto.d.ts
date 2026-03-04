export declare class AgentChatDto {
    message: string;
    personaId?: string;
    context?: string[];
    mood?: 'calm' | 'anxious' | 'sad' | 'excited';
    userId?: string;
}
