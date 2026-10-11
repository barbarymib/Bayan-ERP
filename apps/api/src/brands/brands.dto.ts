import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'CRC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'الخليج للحديد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameAr!: string;
}

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;
}

export class QueryBrandsDto {
  @IsOptional()
  @IsString()
  q?: string;
}
