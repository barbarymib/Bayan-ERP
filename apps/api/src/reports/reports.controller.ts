import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Features, Permissions, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import {
  QueryAgingDto,
  QueryMovementsDto,
  QueryReportSummaryDto,
  QueryStockSummaryDto,
  QueryStockValuesDto,
} from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

@Get('stock-values')
  @Permissions('report.view')
  @Features('reports.valuation')
  @ApiOkResponse({ description: 'تقييم أرصدة المخزون (آخر شراء / متوسط مرجح / سعر البيع)' })
  stockValues(@Query() query: QueryStockValuesDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.stockValues(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

@Get('reports/movements')
  @Permissions('report.view')
  @Features('reports.valuation')
  @ApiOkResponse({ description: 'دفتر حركات المخزون' })
  movements(@Query() query: QueryMovementsDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.movements(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

@Get('reports/low-stock')
  @Permissions('report.view')
  @Features('reports.valuation')
  @ApiOkResponse({ description: 'أصناف تحت الحد الأدنى' })
  lowStock(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.lowStock(user.companyId ?? null).then((data) => this.respond(res, {}, data));
  }

@Get('reports/stock-summary')
  @Permissions('report.view')
  @Features('reports.valuation')
  @ApiOkResponse({ description: 'ملخص المخزون مع قيد حركة راكدة' })
  stockSummary(@Query() query: QueryStockSummaryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.stockSummary(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

@Get('reports/summary')
  @Permissions('report.view')
  @Features('reports.valuation')
  @ApiOkResponse({ description: 'لوحة المؤشرات' })
  summary(@Query() query: QueryReportSummaryDto, @CurrentUser() user: AuthUser) {
    return this.reports.summary(query, user.companyId ?? null);
  }

  private respond<T>(res: Response, query: unknown, data: T): T {
    if ((query as { format?: string }).format === 'csv' && data && typeof data === 'object') {
      const asRecord = data as Record<string, unknown>;
      const list = asRecord.rows as Record<string, unknown>[] | undefined;
      if (!Array.isArray(list) || list.length === 0) return data;
      const flat = (v: unknown): string | number | null | undefined => {
        if (v && typeof v === 'object' && 'nameAr' in (v as object)) {
          return (v as { nameAr?: unknown }).nameAr as string | number | null | undefined;
        }
        return v as string | number | null | undefined;
      };
      const allKeys: string[] = [];
      for (const r of list) {
        for (const k of Object.keys(r)) {
          if (k !== 'item' && k !== 'warehouse' && k !== 'user' && !allKeys.includes(k)) allKeys.push(k);
        }
      }
      allKeys.sort();
      const headers = allKeys.map((k) => (k === 'itemId' ? 'itemName' : k === 'warehouseId' ? 'warehouseName' : k));
      const csvRows = list.map((r) => allKeys.map((k) => flat(r[k])));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      return this.reports.toCsv(headers, csvRows) as unknown as T;
    }
    return data;
  }

  @Get('reports/aging')
  @Permissions('report.view')
  aging(@Query() query: QueryAgingDto, @CurrentUser() user: AuthUser) {
    return this.reports.aging(query, user.companyId ?? null);
  }
}

