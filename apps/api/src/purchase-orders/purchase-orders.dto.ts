import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
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

export class PurchaseOrderLineDto {
  @ApiProperty({ description: 'الصنف' })
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional({ description: 'الوحدة (افتراضي: الأساسية)' })
  @IsOptional()
  @IsInt()
  unitId?: number;

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

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsInt()
  supplierId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;

  @ApiPropertyOptional({ enum: ['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'], default: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'])
  paymentMethod?: 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET';

  @ApiPropertyOptional({ example: 0, description: 'مصاريف نقل تُوزَّع على البنود (landed cost)' })
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
}

export class CancelPurchaseOrderDto {
  @ApiProperty({ description: 'سبب الإلغاء (إلزامي)' })
  @IsString()
  @MaxLength(255)
  reason!: string;
}

export class QueryPurchaseOrdersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED', 'CLOSED'])
  status?: 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}