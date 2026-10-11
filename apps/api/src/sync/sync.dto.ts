import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { DocPrefix } from '@bayan/shared';

export class DeviceRegisterDto {
  @ApiProperty({ example: 'SM-G990E-xyz', description: 'معرّف الجهاز الفريد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceId!: string;

  @ApiPropertyOptional({ example: 'هاتف محمد' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class ReserveBlockDto {
  @ApiProperty({ enum: ['BP', 'PR', 'RT', 'RC', 'PV', 'ST'] })
  @IsIn(['BP', 'PR', 'RT', 'RC', 'PV', 'ST'])
  kind!: DocPrefix;

  @ApiProperty({ example: 'M03', description: 'كود المندوب (فارغ للمكتب)' })
  @IsString()
  @MaxLength(50)
  repCode!: string;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  count?: number;
}

export class PushItemDto {
  @ApiProperty({ description: 'معرّف فريد من الجهاز (يمنع التكرار أوفلاين)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  clientUuid!: string;

  @ApiProperty({ enum: ['price_statement', 'return_statement', 'receipt'] })
  @IsIn(['price_statement', 'return_statement', 'receipt'])
  type!: 'price_statement' | 'return_statement' | 'receipt';

  @ApiProperty({ description: 'البيانات الكاملة كما خزّنها الجهاز' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'رقم المستند المحلي (إن وجد)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;
}

export class PushDto {
  @ApiProperty({ type: [PushItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PushItemDto)
  items!: PushItemDto[];
}