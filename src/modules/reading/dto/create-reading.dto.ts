import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export type DivinationCategory = 'career' | 'love' | 'wealth' | 'health' | 'growth' | 'general';

export class CreateReadingDto {
  @IsString()
  @MaxLength(1000)
  question: string;

  @IsString()
  @IsOptional()
  category?: DivinationCategory;

  @IsArray()
  @IsOptional()
  keywords?: string[];
  
  @IsString()
  @IsOptional()
  userId?: string;
}
