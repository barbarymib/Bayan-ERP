import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
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

export class SupplierReturnLineDto {
  @ApiProperty()
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  unitId?: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @ApiProperty({ example: 27000 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateSupplierReturnDto {
  @ApiProperty()
  @IsInt()
  supplierId!: number;

  @ApiProperty()
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({ type: [SupplierReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierReturnLineDto)
  lines!: SupplierReturnLineDto[];
}

export class QuerySupplierReturnsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}