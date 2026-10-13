import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Features, Permissions, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { toXlsx } from '../common/xlsx.js';
import {
  QueryAgingDto,
  QueryDiscountApprovalsDto,
  QueryDiscountsDto,
  QueryMovementsDto,
  QueryReportSummaryDto,
  QueryRepPerformanceDto,
  QueryReturnsDto,
  QuerySalesByDto,
  QuerySalesSummaryDto,
  QueryStockSummaryDto,
  QueryStockValuesDto,
  QueryStocktakeDiffDto,
  QueryStoppedCustomersDto,
  QuerySupplierDebtDto,
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

  @Get('reports/sales-summary')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'المبيعات حسب الفترة (يومي/شهري) — الأرباح لمن يملك cost.view' })
  salesSummary(@Query() query: QuerySalesSummaryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports
      .salesSummary(query, user.companyId ?? null, user.permissions.includes('cost.view'))
      .then((data) => this.respond(res, query, data));
  }

  @Get('reports/sales-by')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'المبيعات حسب بُعد: صنف/تصنيف/ماركة/عميل/مندوب/مخزن' })
  salesBy(@Query() query: QuerySalesByDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports
      .salesBy(query, user.companyId ?? null, user.permissions.includes('cost.view'))
      .then((data) => this.respond(res, query, data));
  }

  @Get('reports/discounts')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'إجمالي الخصومات حسب المستخدم/المندوب/الصنف' })
  discounts(@Query() query: QueryDiscountsDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.discountsBy(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/discount-approvals')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'الخصومات المتجاوزة وطلبات اعتمادها' })
  discountApprovals(@Query() query: QueryDiscountApprovalsDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.discountApprovals(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/returns')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'المرتجعات حسب العميل/المندوب/السبب/الصنف ونسبة المرتجع إلى المبيعات' })
  returns(@Query() query: QueryReturnsDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.returnsBy(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/stopped-customers')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'العملاء المتوقفون (لا مبيعات خلال آخر N يوم)' })
  stoppedCustomers(@Query() query: QueryStoppedCustomersDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.stoppedCustomers(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/stocktake-diff')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'فروقات الجرد: النظام مقابل المعدود وقيمة الفرق' })
  stocktakeDiff(@Query() query: QueryStocktakeDiffDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.stocktakeDiff(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/supplier-debt')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'مديونية الموردين (الرصيد الافتتاحي + المشتريات − المدفوع)' })
  supplierDebt(@Query() query: QuerySupplierDebtDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.supplierDebt(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  @Get('reports/rep-performance')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'أداء المناديب: الأهداف والتحصيل والزيارات والمسافات' })
  repPerformance(@Query() query: QueryRepPerformanceDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return this.reports.repPerformance(query, user.companyId ?? null).then((data) => this.respond(res, query, data));
  }

  private respond<T>(res: Response, query: unknown, data: T): T | StreamableFile {
    const format = (query as { format?: string }).format;
    if ((format === 'csv' || format === 'xlsx') && data && typeof data === 'object') {
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
      const rows = list.map((r) => allKeys.map((k) => flat(r[k])));

      if (format === 'xlsx') {
        const buf = toXlsx([{ name: 'report', headers, rows }]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
        return new StreamableFile(buf);
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      return this.reports.toCsv(headers, rows) as unknown as T;
    }
    return data;
  }

  @Get('reports/aging')
  @Permissions('report.view')
  aging(@Query() query: QueryAgingDto, @CurrentUser() user: AuthUser) {
    return this.reports.aging(query, user.companyId ?? null);
  }
}

