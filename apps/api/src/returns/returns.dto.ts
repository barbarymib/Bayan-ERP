import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsBoolean,
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

export class ReturnLineInputDto {
  @ApiPropertyOptional({ description: 'معرّف بند بيان البيع الأصلي (أساس التسعير) — مطلوب إلا في مرتجع بدون بيان' })
  @IsOptional()
  @IsNumber()
  sourceLineId?: number;

  @ApiPropertyOptional({ description: 'الصنف (للمرتجع بدون بيان أصلي)' })
  @IsOptional()
  @IsNumber()
  itemId?: number;

  @ApiPropertyOptional({ description: 'سعر الوحدة المُدخل (للمرتجع بدون بيان أصلي)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @ApiPropertyOptional({ example: 'can', description: 'وحدة العودة (افتراضي: وحدة البيع الأصلية)' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiProperty({ enum: ['GOOD', 'DAMAGED'], default: 'GOOD' })
  @IsIn(['GOOD', 'DAMAGED'])
  condition!: 'GOOD' | 'DAMAGED';
}

export class CreateReturnDto {
  @ApiProperty({ enum: ['BY_CUSTOMER', 'BY_REP'], description: 'مرتجع حسب العميل أو حسب المندوب' })
  @IsIn(['BY_CUSTOMER', 'BY_REP'])
  mode!: 'BY_CUSTOMER' | 'BY_REP';

  @ApiProperty()
  @IsNumber()
  customerId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ enum: ['DEFECT', 'WRONG_ORDER', 'DAMAGED', 'OTHER'], description: 'سبب المرتجع (إلزامي)' })
  @IsIn(['DEFECT', 'WRONG_ORDER', 'DAMAGED', 'OTHER'])
  reasonCode!: 'DEFECT' | 'WRONG_ORDER' | 'DAMAGED' | 'OTHER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ description: 'معرّف فريد من الجهاز' })
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @ApiPropertyOptional({ description: 'رقم من كتلة الأرقام المحجوزة للجهاز (يُصدر مركزيّاً إن غاب)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @ApiPropertyOptional({ description: 'مرتجع بدون بيان أصلي (يتطلب صلاحية return.without_statement)' })
  @IsOptional()
  @IsBoolean()
  withoutStatement?: boolean;

  @ApiPropertyOptional({ enum: ['BALANCE', 'CASH', 'CREDIT'], default: 'BALANCE', description: 'أثر المرتجع المالي' })
  @IsOptional()
  @IsIn(['BALANCE', 'CASH', 'CREDIT'])
  settlement?: 'BALANCE' | 'CASH' | 'CREDIT';

  @ApiProperty({ type: [ReturnLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineInputDto)
  lines!: ReturnLineInputDto[];
}

export class QueryReturnsDto {
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

  @ApiPropertyOptional({ enum: ['DRAFT', 'APPROVED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'CANCELLED'])
  status?: 'DRAFT' | 'APPROVED' | 'CANCELLED';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}