import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TrackEventItemDto {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;

  /** 客户端时间 ISO8601，便于与服务端时间对齐排查 */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientTime?: string;
}

export class ClientInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  timezone?: string;

  /** 国家/地区代码或用户自选地区标签，如 CN、US */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;
}

export class TrackEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventItemDto)
  @ArrayMaxSize(50)
  events!: TrackEventItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientInfoDto)
  client?: ClientInfoDto;
}

export class SubmitFeedbackDto {
  @IsString()
  @MaxLength(64)
  category!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class EmailLeadDto {
  @IsString()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ctaPath?: string;
}
