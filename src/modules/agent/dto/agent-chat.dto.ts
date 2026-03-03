import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

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
}

