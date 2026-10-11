import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReceiptDto {
  @ApiProperty()
  @IsNumber()
  customerId!: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ enum: ['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'], default: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'])
  method?: 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET';

  @ApiPropertyOptional({ description: 'ربط المبلغ ببيان محدد' })
  @IsOptional()
  @IsNumber()
  statementId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ description: 'شيك: رقم الشيك' })
  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @ApiPropertyOptional({ description: 'شيك: اسم البنك' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ description: 'شيك: تاريخ الاستحقاق' })
  @IsOptional()
  @IsDateString()
  chequeDueDate?: string;

  @ApiPropertyOptional({ description: 'معرّف فريد من الجهاز (منع التكرار أوفلاين)' })
  @IsOptional()
  @IsString()
  clientUuid?: string;

  @ApiPropertyOptional({ description: 'رقم من كتلة الأرقام المحجوزة للجهاز (يُصدر مركزيّاً إن غاب)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  number?: string;

  @ApiPropertyOptional({ description: 'حساب الخزينة المستلم (افتراضياً أول حساب نشط)' })
  @IsOptional()
  @IsNumber()
  cashAccountId?: number;
}

export class QueryReceiptsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({ enum: ['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'] })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'])
  method?: 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreatePaymentDto {
  @ApiProperty()
  @IsNumber()
  supplierId!: number;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ enum: ['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'], default: 'CASH' })
  @IsOptional()
  @IsIn(['CASH', 'TRANSFER', 'CHEQUE', 'WALLET'])
  method?: 'CASH' | 'TRANSFER' | 'CHEQUE' | 'WALLET';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({ description: 'حساب الخزينة الدافع (افتراضياً أول حساب نشط)' })
  @IsOptional()
  @IsNumber()
  cashAccountId?: number;

  @ApiPropertyOptional({ description: 'ربط المبلغ ببيان توريد محدد' })
  @IsOptional()
  @IsNumber()
  statementId?: number;
}

export class UpdateChequeStatusDto {
  @ApiProperty({ enum: ['COLLECTED', 'RETURNED'] })
  @IsIn(['COLLECTED', 'RETURNED'])
  status!: 'COLLECTED' | 'RETURNED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class QueryStatementOfAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}