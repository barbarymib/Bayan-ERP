import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Features, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { BulkPriceDto, QueryPriceDto, QueryPriceHistoryDto, SetPriceDto } from './prices.dto.js';
import { PricesService } from './prices.service.js';

@ApiTags('prices')
@ApiBearerAuth()
@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get()
  @ApiOkResponse({ description: 'السعر الحالي لصنف في قائمة (بالوحدة الافتراضية للصنف)' })
  resolve(@Query() query: QueryPriceDto, @CurrentUser() user: AuthUser) {
    return this.prices.resolve(query, user.companyId ?? null);
  }

  @Get('history')
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'سجل تغييرات أسعار صنف' })
  history(@Query() query: QueryPriceHistoryDto, @CurrentUser() user: AuthUser) {
    return this.prices.history(query.itemCode, query.priceListCode, query.limit ?? 30, user.companyId ?? null);
  }

  @Post()
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'تعيين سعر صنف وتتبع تغييره' })
  set(@Body() dto: SetPriceDto, @CurrentUser() user: AuthUser) {
    return this.prices.set(dto, user.id, user.companyId ?? null);
  }

  @Post('bulk')
  @Permissions('price.manage')
  @Features('pricing.bulk')
  @ApiOkResponse({ description: 'تسعير يومي جماعي (نسبة/قيمة/set) مع سجل التغييرات' })
  bulk(@Body() dto: BulkPriceDto, @CurrentUser() user: AuthUser) {
    return this.prices.bulk(dto, user.id, user.companyId ?? null);
  }
}