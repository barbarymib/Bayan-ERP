import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ArchiveRangeDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ example: '2026-10-07' })
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({ example: 'ترحيل النصف الأول' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ArchiveConfirmDto {
  @ApiProperty({ example: 'أرشفة', description: 'كلمة التأكيد المطلوبة للحذف' })
  @IsString()
  @MaxLength(50)
  confirmText!: string;
}

export class ArchiveViewerQueryDto {
  @ApiPropertyOptional({ example: 'price_statements' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'BP-000001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 100, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
