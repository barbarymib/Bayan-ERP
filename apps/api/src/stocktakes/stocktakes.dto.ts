import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class StocktakeScopeDto {
  @ApiPropertyOptional({ type: [Number], description: 'أصناف محددة (جزئي)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  itemIds?: number[];

  @ApiPropertyOptional({ type: [Number], description: 'تصنيفات محددة (جزئي)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional({ type: [Number], description: 'ماركات محددة (جزئي)' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  brandIds?: number[];
}

export class OpenStocktakeDto {
  @ApiProperty({ description: 'المخزن المُجرى عليه الجرد' })
  @IsInt()
  warehouseId!: number;

  @ApiPropertyOptional({ description: 'نطاق الجرد (كلي عند غيابه)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => StocktakeScopeDto)
  scope?: StocktakeScopeDto;
}

export class StocktakeCountInputDto {
  @ApiProperty({ description: 'الصنف' })
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional({ default: '', description: 'التشغيلة (فارغ افتراضياً)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  batchId?: string;

  @ApiProperty({ example: 100, description: 'الكمية الفعلية بالوحدة الأساسية' })
  @IsNumber()
  @Min(0)
  qty!: number;

  @ApiPropertyOptional({ description: 'اسم/معرّف العداد (يدعم أكثر من عداد §5.8.3)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  counter?: string;
}

export class StocktakeCountsDto {
  @ApiProperty({ type: [StocktakeCountInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StocktakeCountInputDto)
  counts!: StocktakeCountInputDto[];
}

export class AbortStocktakeDto {
  @ApiProperty({ description: 'سبب الإلغاء (إلزامي)' })
  @IsString()
  @MaxLength(255)
  reason!: string;
}

export class ApproveStocktakeDto {
  @ApiPropertyOptional({ description: 'تأكيد اعتماد الفروقات الكبيرة رغم تجاوز حد إعادة العد (§5.8.5)' })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class QueryStocktakesDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'COUNTING', 'REVIEW', 'APPROVED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'COUNTING', 'REVIEW', 'APPROVED', 'CLOSED'])
  status?: 'OPEN' | 'COUNTING' | 'REVIEW' | 'APPROVED' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}