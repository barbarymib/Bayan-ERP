import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class StartShiftDto {
  @ApiPropertyOptional({ example: 30.0444 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 31.2357 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: 'dev-abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}

export class EndShiftDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  shiftId?: number;

  @ApiPropertyOptional({ example: 30.0444 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 31.2357 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class LocationDto {
  @ApiProperty({ example: 30.0444 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 31.2357 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ example: 12.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery?: number;

  @ApiPropertyOptional({ example: '2026-10-07T08:15:00.000Z' })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

export class VisitDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  customerId!: number;

  @ApiProperty({ enum: ['DONE', 'MISSED'] })
  @IsIn(['DONE', 'MISSED'])
  status!: 'DONE' | 'MISSED';

  @ApiPropertyOptional({ example: 'العميل خارج المنطقة' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ example: 30.0444 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 31.2357 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: '2026-10-07T08:15:00.000Z' })
  @IsOptional()
  @IsDateString()
  at?: string;
}

export class QueryGeoDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-07' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  repId?: number;
}

export class ConsentDto {
  @ApiProperty({ enum: ['GEO_TRACKING'], example: 'GEO_TRACKING' })
  @IsIn(['GEO_TRACKING'])
  type!: 'GEO_TRACKING';

  @ApiProperty({ example: '1.0', description: 'نسخة نص الإقرار المُوقّع عليها' })
  @IsString()
  @MaxLength(20)
  version!: string;

  @ApiProperty({ example: 'أحمد محمد علي', description: 'الاسم الكامل للمُوقِّع كما كتبه (توقيع إلكتروني)' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  signatureName!: string;

  @ApiPropertyOptional({ example: 'dev-abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}