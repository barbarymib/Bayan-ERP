import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ description: 'اسم الشركة' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'هاتف الشركة' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'البريد الإلكتروني للشركة' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'الشخص المسؤول' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

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
