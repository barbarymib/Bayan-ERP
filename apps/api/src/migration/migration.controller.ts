import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Permissions } from '../auth/auth.decorators.js';
import { LegacyImportDto } from './migration.dto.js';
import { MigrationService } from './migration.service.js';

@ApiTags('migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post('import')
  @Permissions('opening_stock.execute')
  @ApiOkResponse({ description: 'استيراد بيانات النظام القديم (تجربة موازية — مرحلة الإطلاق)' })
  import(@Body() dto: LegacyImportDto, @CurrentUser() user: AuthUser) {
    return this.migration.importPayload(dto, user.id);
  }

  @Get('template')
  @ApiOkResponse({ description: 'قالب JSON لملف الاستيراد' })
  template() {
    return {
      mode: 'MERGE',
      categories: [{ code: 'PAINT', nameAr: 'دهانات' }],
      units: [{ code: 'kg', nameAr: 'كيلوجرام', measurement: 'WEIGHT' }],
      priceLists: [{ code: 'RETAIL', nameAr: 'تجزئة' }],
      warehouses: [{ code: 'MAIN', nameAr: 'المخزن الرئيسي', type: 'MAIN' }],
      items: [
        {
          code: 'IR-16-10',
          nameAr: 'حديد تسليح 16مم',
          categoryCode: 'PAINT',
          baseUnitCode: 'kg',
          prices: [{ priceListCode: 'RETAIL', price: 120.5 }],
        },
      ],
      suppliers: [{ code: 'SUP-01', nameAr: 'مورّد', phone: '', openingBalance: 0 }],
      customers: [
        {
          code: 'CUST-01',
          nameAr: 'عميل',
          priceListCode: 'RETAIL',
          creditLimit: 0,
          creditDays: 30,
          openingBalance: 0,
        },
      ],
      openingStock: [{ itemCode: 'IR-16-10', warehouseCode: 'MAIN', qtyBase: 100, cost: 100 }],
    };
  }
}