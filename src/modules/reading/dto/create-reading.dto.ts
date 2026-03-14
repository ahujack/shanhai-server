import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export type DivinationCategory = 'career' | 'love' | 'wealth' | 'health' | 'growth' | 'general';

export class CreateReadingDto {
  @IsString()
  @MinLength(2, { message: '问题至少需要2个字符' })
  @MaxLength(500, { message: '问题长度不能超过500字符' })
  question: string;

  @IsString()
  @IsOptional()
  category?: DivinationCategory;

  @IsArray()
  @IsOptional()
  keywords?: string[];
}
