import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCashAccountDto {
  @ApiProperty({ example: 'MAIN' })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  nameAr!: string;

  @ApiPropertyOptional({ enum: ['CASH', 'BANK', 'WALLET'], default: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'BANK', 'WALLET'])
  type?: 'CASH' | 'BANK' | 'WALLET';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;
}

export class UpdateCashAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiPropertyOptional({ enum: ['CASH', 'BANK', 'WALLET'] })
  @IsOptional()
  @IsIn(['CASH', 'BANK', 'WALLET'])
  type?: 'CASH' | 'BANK' | 'WALLET';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateHandoverDto {
  @ApiProperty()
  @IsInt()
  repId!: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  cashAccountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class QueryHandoversDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  repId?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class DailyCloseDto {
  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'الرصيد الفعلي المُعدّ (للجرد النقدي)' })
  @IsOptional()
  @IsNumber()
  countedBalance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}