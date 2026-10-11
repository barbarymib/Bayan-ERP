import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SetPriceDto {
  @ApiProperty({ example: 'IR-12-10' })
  @IsString()
  @MaxLength(50)
  itemCode!: string;

  @ApiPropertyOptional({ example: 'ton' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  @MaxLength(30)
  priceListCode!: string;

  @ApiProperty({ example: 27000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class BulkPriceItemDto {
  @ApiProperty({ example: 'IR-12-10' })
  @IsString()
  itemCode!: string;

  @ApiProperty({ example: 27500 })
  @IsNumber()
  @Min(0)
  price!: number;
}

export class BulkPriceDto {
  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  priceListCode!: string;

  @ApiPropertyOptional({ example: 'ton', description: 'الوحدة الموحدة (الافتراضي: الوحدة الأساسية لكل صنف)' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional({ example: 3, description: 'تعديل بنسبة مئوية (+3 = زيادة 3%)' })
  @IsOptional()
  @IsNumber()
  changeByPercent?: number;

  @ApiPropertyOptional({ example: 150, description: 'تعديل بقيمة ثابتة (+150)' })
  @IsOptional()
  @IsNumber()
  changeByAmount?: number;

  @ApiPropertyOptional({ example: 'STEEL', description: 'تسعير صنف/تصنيف محدد' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: 'المنتجات الواردة من مورد معين (شركة)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @ApiPropertyOptional({ description: 'تسعير بأكواد محددة' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemCodes?: string[];

  @ApiPropertyOptional({ description: 'تسعير مباشر (set) لقائمة أصناف' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPriceItemDto)
  set?: BulkPriceItemDto[];

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class QueryPriceDto {
  @ApiProperty()
  @IsString()
  itemCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional({ default: 'RETAIL' })
  @IsOptional()
  @IsString()
  priceListCode?: string;

  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class QueryPriceHistoryDto {
  @IsString()
  itemCode!: string;

  @IsOptional()
  @IsString()
  priceListCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}