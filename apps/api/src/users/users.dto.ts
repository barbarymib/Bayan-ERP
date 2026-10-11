import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'أحمد على' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'SALES_REP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  roleCode!: string;

  @ApiPropertyOptional({ example: 'rep01@bayan.local' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0101234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'M01', description: 'كود المندوب للترقيم أوفلاين' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  repCode?: string;

  @ApiPropertyOptional({ example: 1, description: 'معرف الفرع المسؤول' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  branchId?: number;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ default: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxItemDiscountPct?: number;

  @ApiPropertyOptional({ default: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxInvoiceDiscountPct?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  roleCode?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  repCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  branchId?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxItemDiscountPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxInvoiceDiscountPct?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryUsersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  roleCode?: string;

  @IsOptional()
  @IsString()
  active?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['statement.create', 'report.view'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}