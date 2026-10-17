import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CLASSIFICATIONS = ['A', 'B', 'C'] as const;
const MEASUREMENTS = ['COUNT', 'WEIGHT'] as const;
const WAREHOUSE_TYPES = ['MAIN', 'STEEL', 'PAINT', 'REP', 'DAMAGED', 'SHOWROOM'] as const;
const MODES = ['MERGE', 'STRICT'] as const;

export class MigrationUnitDto {
  @ApiProperty({ example: 'kg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ example: 'كيلوجرام' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nameEn?: string;

  @ApiPropertyOptional({ enum: MEASUREMENTS, default: 'COUNT' })
  @IsOptional()
  @IsIn([...MEASUREMENTS])
  measurement?: (typeof MEASUREMENTS)[number];
}

export class MigrationCategoryDto {
  @ApiProperty({ example: 'PAINT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'دهانات' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'كود الفئة الأب' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentCode?: string;
}

export class MigrationPriceListDto {
  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'تجزئة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;
}

export class MigrationWarehouseDto {
  @ApiProperty({ example: 'MAIN' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'المخزن الرئيسي' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional({ enum: WAREHOUSE_TYPES, default: 'MAIN' })
  @IsOptional()
  @IsIn([...WAREHOUSE_TYPES])
  type?: (typeof WAREHOUSE_TYPES)[number];

  @ApiPropertyOptional({ description: 'كود المندوب المسؤول' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  keeperRepCode?: string;
}

export class MigrationItemPriceDto {
  @ApiProperty({ example: 'RETAIL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  priceListCode!: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'وحدة السعر (افتراضياً الوحدة الأساسية)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unitCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class MigrationItemDto {
  @ApiProperty({ example: 'IR-16-10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'حديد تسليح 16مم' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'كود الفئة (افتراضياً الفئة العامة "GEN")' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @ApiProperty({ example: 'ton' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  baseUnitCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @ApiPropertyOptional({ description: 'متوسط تكلفة آخر الشراء' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lastCost?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [MigrationItemPriceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationItemPriceDto)
  prices?: MigrationItemPriceDto[];
}

export class MigrationSupplierDto {
  @ApiProperty({ example: 'SUP-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'مصنع الحديد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: 'رصيد افتتاحي (ذمم موردين)' })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class MigrationCustomerDto {
  @ApiProperty({ example: 'CUST-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'شركة البناء الحديث' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ description: 'قائمة الأسعار (افتراضياً RETAIL)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  priceListCode?: string;

  @ApiPropertyOptional({ description: 'كود المندوب المسؤول' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  repCode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({ enum: CLASSIFICATIONS, default: 'C' })
  @IsOptional()
  @IsIn([...CLASSIFICATIONS])
  classification?: (typeof CLASSIFICATIONS)[number];

  @ApiPropertyOptional({ description: 'رصيد افتتاحي (ذمم عملاء)' })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class MigrationOpeningStockDto {
  @ApiProperty({ description: 'كود الصنف' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode!: string;

  @ApiProperty({ description: 'كود المخزن' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  warehouseCode!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  qtyBase!: number;

  @ApiPropertyOptional({ description: 'متوسط تكلفة الكمية' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

export class LegacyImportDto {
  @ApiPropertyOptional({ enum: MODES, default: 'MERGE', description: 'STRICT يلغي الاستيراد كاملاً عند أي تعارض' })
  @IsOptional()
  @IsIn([...MODES])
  mode?: (typeof MODES)[number];

  @ApiPropertyOptional({ type: [MigrationCategoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationCategoryDto)
  categories?: MigrationCategoryDto[];

  @ApiPropertyOptional({ type: [MigrationUnitDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationUnitDto)
  units?: MigrationUnitDto[];

  @ApiPropertyOptional({ type: [MigrationPriceListDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationPriceListDto)
  priceLists?: MigrationPriceListDto[];

  @ApiPropertyOptional({ type: [MigrationWarehouseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationWarehouseDto)
  warehouses?: MigrationWarehouseDto[];

  @ApiPropertyOptional({ type: [MigrationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationItemDto)
  items?: MigrationItemDto[];

  @ApiPropertyOptional({ type: [MigrationSupplierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationSupplierDto)
  suppliers?: MigrationSupplierDto[];

  @ApiPropertyOptional({ type: [MigrationCustomerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationCustomerDto)
  customers?: MigrationCustomerDto[];

  @ApiPropertyOptional({ type: [MigrationOpeningStockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationOpeningStockDto)
  openingStock?: MigrationOpeningStockDto[];
}