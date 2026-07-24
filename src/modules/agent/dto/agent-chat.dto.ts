import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AgentChatDto {
  @IsString()
  @MaxLength(1200)
  message: string;

  @IsOptional()
  @IsString()
  personaId?: string;

  @IsOptional()
  @IsArray()
  context?: string[];

  @IsOptional()
  @IsString()
  mood?: 'calm' | 'anxious' | 'sad' | 'excited';
  
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  clientLocalHour?: number;

  @IsOptional()
  @IsString()
  language?: 'zh-CN' | 'en-US' | 'zh-TW';

  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
