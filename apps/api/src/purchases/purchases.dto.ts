import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountInputDto } from '../price-statements/price-statements.dto.js';

export class PurchaseLineInputDto {
  @ApiProperty({ example: 'IR-16-10', description: 'كود الصنف' })
  @IsString()
  @MaxLength(50)
  itemCode!: string;

  @ApiPropertyOptional({ example: 'ton', description: 'الوحدة (افتراضي: الأساسية)' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @ApiProperty({ example: 27000 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountInputDto)
  discount?: DiscountInputDto;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsNumber()
  supplierId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ type: [PurchaseLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineInputDto)
  lines!: PurchaseLineInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountInputDto)
  discount?: DiscountInputDto;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping?: number;

  @ApiPropertyOptional({
    enum: ['VALUE', 'QTY'],
    default: 'VALUE',
    description: 'أساس توزيع مصاريف النقل على تكلفة الأصناف (§5.5)',
  })
  @IsOptional()
  @IsIn(['VALUE', 'QTY'])
  landedCostBasis?: 'VALUE' | 'QTY';

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;

  @ApiPropertyOptional({ enum: ['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'], default: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'])
  paymentMethod?: 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class QueryPurchasesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supplierId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}