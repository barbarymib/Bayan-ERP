import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UnitMeasurement } from '../generated/prisma/client';

export class CreateUnitDto {
  @ApiProperty({ example: 'carton' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'كرتونة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @ApiProperty({ enum: UnitMeasurement, example: UnitMeasurement.COUNT })
  @IsEnum(UnitMeasurement)
  measurement!: UnitMeasurement;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsEnum(UnitMeasurement)
  measurement?: UnitMeasurement;
}

export class QueryUnitsDto {
  @ApiPropertyOptional({ enum: UnitMeasurement })
  @IsOptional()
  @IsEnum(UnitMeasurement)
  measurement?: UnitMeasurement;

  @IsOptional()
  @IsString()
  q?: string;
}