import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCustomerGroupDto {
  @ApiProperty({ example: 'G-VIP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'عملاء كبار' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCustomerGroupDto extends PartialType(CreateCustomerGroupDto) {}

export class QueryCustomerGroupsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateSpecialPriceDto {
  @ApiProperty({ example: 'IR-16-10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode!: string;

  @ApiPropertyOptional({ example: 'ton' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unitCode?: string;

  @ApiPropertyOptional({ example: 'CUST-01', description: 'سعر خاص لعميل محدد' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerCode?: string;

  @ApiPropertyOptional({ example: 'G-VIP', description: 'سعر خاص لمجموعة عملاء' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerGroupCode?: string;

  @ApiPropertyOptional({ example: 'RETAIL', description: 'سعر خاص لقائمة أسعار' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  priceListCode?: string;

  @ApiProperty({ example: 26500 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'من تاريخ (افتراضي: الآن)' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ (بلا تاريخ = مفتوح)' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSpecialPriceDto extends PartialType(CreateSpecialPriceDto) {}

export class QuerySpecialPricesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerGroupCode?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'ALL'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ALL'])
  state?: 'ACTIVE' | 'INACTIVE' | 'ALL';
}
