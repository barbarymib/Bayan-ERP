import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
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

export class TransferLineDto {
  @ApiProperty({ description: 'الصنف' })
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional({ default: '', description: 'التشغيلة (فارغ افتراضياً)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  batchId?: string;

  @ApiProperty({ description: 'الكمية بالوحدة الأساسية' })
  @IsNumber()
  @Min(0.001)
  qtyBase!: number;

  @ApiPropertyOptional({ description: 'تكلفة الوحدة الأساسية' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

export class CreateTransferDto {
  @ApiProperty({ description: 'المخزن المصدر' })
  @IsInt()
  fromWarehouseId!: number;

  @ApiProperty({ description: 'المخزن الوجهة' })
  @IsInt()
  toWarehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

export class QueryTransfersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}