import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const SALES_DIMENSIONS = ['item', 'category', 'brand', 'customer', 'rep', 'warehouse'] as const;
export type SalesDimension = (typeof SALES_DIMENSIONS)[number];

export const DISCOUNT_DIMENSIONS = ['user', 'rep', 'item'] as const;
export type DiscountDimension = (typeof DISCOUNT_DIMENSIONS)[number];
class CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  format?: string;
}

export class QueryStockValuesDto extends CsvQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  method?: 'LAST' | 'WEIGHTED' | 'SALES' = 'LAST';
}

export class QueryMovementsDto extends CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  itemId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 500;
}

export class QueryReportSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;
}

export class QueryStockSummaryDto extends CsvQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'stagnantDays must be number' })
  @Min(0)
  stagnantDays?: number = 90;
}

export class QuerySalesSummaryDto extends CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month' = 'day';
}

export class QuerySalesByDto extends CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsIn(SALES_DIMENSIONS)
  by!: SalesDimension;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class QueryDiscountsDto extends CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsIn(DISCOUNT_DIMENSIONS)
  by!: DiscountDimension;
}

export class QueryDiscountApprovalsDto extends CsvQuery {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 200;
}

export class QueryAgingDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  days1?: number = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  days2?: number = 60;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  days3?: number = 90;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number = 1000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
