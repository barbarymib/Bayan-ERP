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
import { DiscountInputDto, StatementLineInputDto } from '../price-statements/price-statements.dto.js';

export class CreateQuotationDto {
  @ApiProperty({ description: 'العميل' })
  @IsNumber()
  customerId!: number;

  @ApiPropertyOptional({ description: 'المخزن (افتراضي: الرئيسي)' })
  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @ApiPropertyOptional({ description: 'تاريخ صلاحية العرض' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ type: [StatementLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StatementLineInputDto)
  lines!: StatementLineInputDto[];

  @ApiPropertyOptional({ description: 'خصم العرض ككل' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountInputDto)
  discount?: DiscountInputDto;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ description: 'رقم من كتلة الأرقام (يُصدر إن غاب)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;
}

export class QueryQuotationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  repId?: number;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'])
  status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED';

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

export class QuotationActionDto {
  @ApiPropertyOptional({ description: 'ملاحظة الاختيارية للرفض' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
