import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ example: 1, description: 'معرّف الصنف' })
  @IsInt()
  itemId!: number;

  @ApiProperty({ example: 'B-2026-01', description: 'كود الدفعة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiPropertyOptional({ example: '2026-01-15', description: 'تاريخ الإنتاج' })
  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @ApiPropertyOptional({ example: '2027-01-15', description: 'تاريخ انتهاء الصلاحية' })
  @IsOptional()
  @IsDateString()
  expiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class UpdateBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  productionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryBatchesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  itemId?: number;

  @ApiPropertyOptional({ description: 'مرشّح بالكود' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'الدفعات المنتهية قبل هذا التاريخ (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expiringBefore?: string;

  @ApiPropertyOptional({ description: 'تضمين الدفعات المنتهية فعلاً' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({ description: 'تضمين الدفعات المعطّلة' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}
