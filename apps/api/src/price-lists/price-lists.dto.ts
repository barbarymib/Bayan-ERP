import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePriceListDto {
  @ApiProperty({ example: 'WHOLESALE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'جملة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePriceListDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryPriceListsDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  q?: string;
}