import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ description: 'الضريبة الافتراضية للشركة %', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;
}

export class SetFeatureDto {
  @ApiProperty({ description: 'تفعيل/تعطيل الميزة على مستوى الشركة (يستبدل الحالة العامة)' })
  @IsBoolean()
  enabled!: boolean;
}

export class SetUserFeatureDto {
  @ApiPropertyOptional({ description: 'قيمة الميزة لهذا المستخدم؛ null لحذف الاستبدال والإرجاع للحالة العامة/الشركة' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
