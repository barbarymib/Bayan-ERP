import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemUnitDto {
  @ApiProperty({ example: 'ton' })
  @IsString()
  @IsNotEmpty()
  unitCode!: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0.000001)
  factorToBase!: number;

  @IsOptional()
  @IsBoolean()
  isSale?: boolean;

  @IsOptional()
  @IsBoolean()
  isPurchase?: boolean;

  @IsOptional()
  @IsBoolean()
  allowDecimal?: boolean;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class ItemAttributeDto {
  @ApiProperty({ example: 'درجة' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ example: '3 لين' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateItemDto {
  @ApiProperty({ example: 'IR-12-10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'حديد تسليح 10مم 3لين' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @ApiProperty({ example: 'STEEL' })
  @IsString()
  @IsNotEmpty()
  categoryCode!: string;

  @IsOptional()
  @IsString()
  brandCode?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ example: 'ton' })
  @IsString()
  @IsNotEmpty()
  baseUnitCode!: string;

  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 45000, description: 'حد أدنى لسعر البيع للوحدة الأساسية (§5.3)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSalePrice?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'رابط صورة الصنف أو data URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentItemId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemUnitDto)
  itemUnits?: ItemUnitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemAttributeDto)
  attributes?: ItemAttributeDto[];
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameEn?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  brandCode?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ example: 45000, description: 'حد أدنى لسعر البيع للوحدة الأساسية (§5.3)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSalePrice?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'رابط صورة الصنف أو data URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'الصنف الأساسي (للتنويعات)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentItemId?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemUnitDto)
  itemUnits?: ItemUnitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemAttributeDto)
  attributes?: ItemAttributeDto[];
}

export class QueryItemsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'تصفية حسب الصنف الأساسي (تنويعات)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  parentItemId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsPositive()
  limit?: number;
}