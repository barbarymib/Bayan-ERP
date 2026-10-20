import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** العملات المدعومة (R3-A13، §3). */
export const SUPPORTED_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'QAR', 'JOD'] as const;

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

  @ApiPropertyOptional({ description: 'شعار الشركة للطباعة — data URL (image/…) أو رابط https؛ نص فارغ لحذفه (R4-C4 §5.6)' })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'الضريبة الافتراضية للشركة %', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @ApiPropertyOptional({ description: 'رمز العملة (R3-A13، §3)', enum: SUPPORTED_CURRENCIES })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES as unknown as string[])
  currency?: string;
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
