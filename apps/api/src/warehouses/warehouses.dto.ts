import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { WarehouseType } from '../generated/prisma/client';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'STEEL-WH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'مخزن الحديد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional({ enum: WarehouseType, default: WarehouseType.MAIN })
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @ApiPropertyOptional({ example: 2, description: 'معرّف أمين المخزن' })
  @IsOptional()
  @IsInt()
  keeperId?: number;

  @ApiPropertyOptional({ example: 1, description: 'معرّف الفرع' })
  @IsOptional()
  @IsInt()
  branchId?: number;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @IsOptional()
  @IsInt()
  keeperId?: number;

  @IsOptional()
  @IsInt()
  branchId?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryWarehousesDto {
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @IsOptional()
  @IsString()
  active?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  limit?: number;
}