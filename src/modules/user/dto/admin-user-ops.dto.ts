import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminGrantPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  points!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class AdminGrantMembershipDto {
  @IsIn(['free', 'premium', 'vip'])
  membership!: 'free' | 'premium' | 'vip';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
