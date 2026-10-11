import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GlobalLoginDto {
  @ApiProperty({ example: 'root' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @ApiProperty({ example: 'admin123' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class QueryCompaniesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}

export class SetEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class SetUserFeatureDto {
  @ApiPropertyOptional({ description: 'حدد للحجز؛ احذف الحقل أو مرّر null لمسح الاستثناء' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class OwnerInputDto {
  @ApiProperty({ example: 'محمد علي' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'owner@acme.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0100000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'secret123' })
  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'acme', description: 'كود فريد للشركة (يُطبَّع إلى حروف صغيرة)' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'شركة أكيم' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ type: OwnerInputDto, description: 'المالك الابتدائي (اختياري) بدور OWNER' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OwnerInputDto)
  owner?: OwnerInputDto;
}