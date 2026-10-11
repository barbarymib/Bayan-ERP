import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VisitPlanLineDto {
  @ApiProperty()
  @IsInt()
  customerId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CreateVisitPlanDto {
  @ApiPropertyOptional({ description: 'المندوب (افتراضي: المستخدم الحالي)' })
  @IsOptional()
  @IsInt()
  repId?: number;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({ type: [VisitPlanLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VisitPlanLineDto)
  lines!: VisitPlanLineDto[];
}

export class UpdateVisitPlanLineDto {
  @ApiProperty({ enum: ['PLANNED', 'DONE', 'MISSED'] })
  @IsIn(['PLANNED', 'DONE', 'MISSED'])
  status!: 'PLANNED' | 'DONE' | 'MISSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class QueryVisitPlansDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  repId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}