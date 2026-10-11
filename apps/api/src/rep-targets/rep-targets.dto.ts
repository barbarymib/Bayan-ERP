import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRepTargetDto {
  @ApiProperty({ example: 'M03', description: 'كود المندوب' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  repCode!: string;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'CUSTOM'], default: 'MONTHLY' })
  @IsOptional()
  @IsIn(['MONTHLY', 'QUARTERLY', 'CUSTOM'])
  periodType?: 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';

  @ApiProperty({ description: 'من تاريخ' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ description: 'إلى تاريخ' })
  @IsDateString()
  toDate!: string;

  @ApiProperty({ example: 200000, description: 'قيمة التارجت' })
  @IsNumber()
  @Min(0)
  targetAmount!: number;

  @ApiPropertyOptional({
    enum: ['COLLECTED', 'SALES'],
    default: 'COLLECTED',
    description: 'أساس العمولة: المحصّل أو المبيعات',
  })
  @IsOptional()
  @IsIn(['COLLECTED', 'SALES'])
  commissionBase?: 'COLLECTED' | 'SALES';

  @ApiProperty({ example: 1.5, description: 'نسبة العمولة %' })
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsIn([true, false])
  active?: boolean;
}

export class UpdateRepTargetDto extends PartialType(CreateRepTargetDto) {}

export class QueryRepTargetsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  repCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([true, false])
  active?: boolean;
}

export class CommissionReportDto {
  @ApiPropertyOptional({ description: 'من تاريخ (افتراضي: أول الشهر)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ (افتراضي: اليوم)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
