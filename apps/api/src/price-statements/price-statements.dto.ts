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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DiscountInputDto {
  @ApiProperty({ enum: ['percent', 'amount'], description: 'نسبة أو قيمة ثابتة' })
  @IsIn(['percent', 'amount'])
  type!: 'percent' | 'amount';

  @ApiProperty({ example: 1, description: 'النسبة (0-100) أو المبلغ بالجنيه حسب النوع' })
  @IsNumber()
  @Min(0)
  @ValidateIf((o: DiscountInputDto) => o.type === 'percent')
  @Max(100)
  value!: number;
}

export class StatementLineInputDto {
  @ApiProperty({ example: 'IR-16-10', description: 'كود الصنف' })
  @IsString()
  @MaxLength(50)
  itemCode!: string;

  @ApiPropertyOptional({ example: 'ton', description: 'الوحدة (افتراضي: الوحدة الأساسية)' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @ApiPropertyOptional({ example: 40000, description: 'سعر الوحدة — يُستكمل من قائمة أسعار العميل إن لم يُرسل' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'خصم الصنف (نسبة أو قيمة)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountInputDto)
  discount?: DiscountInputDto;
}

export class CreateStatementDto {
  @ApiProperty()
  @IsNumber()
  customerId!: number;

  @ApiPropertyOptional({ description: 'المخزن (افتراضي: الرئيسي)' })
  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @ApiPropertyOptional({ enum: ['CASH', 'CREDIT', 'MIXED'], default: 'CREDIT' })
  @IsOptional()
  @IsIn(['CASH', 'CREDIT', 'MIXED'])
  paymentTerm?: 'CASH' | 'CREDIT' | 'MIXED';

  @ApiPropertyOptional({ description: 'تاريخ البيان (افتراضي: الآن)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ type: [StatementLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StatementLineInputDto)
  lines!: StatementLineInputDto[];

  @ApiPropertyOptional({ description: 'خصم البيان ككل' })
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

  @ApiPropertyOptional({ example: 0, description: 'المدفوع نقداً وقت الإصدار' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ description: 'معرّف فريد من الجهاز (منع التكرار أوفلاين)' })
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @ApiPropertyOptional({ description: 'رقم من كتلة الأرقام المحجوزة للجهاز (يُصدر مركزيّاً إن غاب)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class UpdateStatementDto extends CreateStatementDto {
  @ApiPropertyOptional({ description: 'سبب التعديل (يُسجَّل في نسخة البيان عند تعديل بيان معتمد)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class QueryStatementsDto {
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

  @ApiPropertyOptional({ enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ARCHIVED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ARCHIVED', 'CANCELLED'])
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'ARCHIVED' | 'CANCELLED';

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

export class CancelStatementDto {
  @ApiProperty({ description: 'سبب الإلغاء (إلزامي)' })
  @IsString()
  @MaxLength(255)
  reason!: string;
}