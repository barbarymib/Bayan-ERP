import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  QueryPurchaseOrdersDto,
  ReceivePurchaseOrderDto,
} from './purchase-orders.dto.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Post()
  @Permissions('purchase_order.create')
  @ApiOkResponse({ description: 'إنشاء أمر شراء (مسودة)' })
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user);
  }

  @Get()
  @Permissions('purchase_order.view')
  @ApiOkResponse({ description: 'قائمة أوامر الشراء' })
  list(@Query() query: QueryPurchaseOrdersDto, @CurrentUser() user: AuthUser) {
    return this.orders.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('purchase_order.view')
  @ApiOkResponse({ description: 'تفاصيل أمر شراء' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.orders.get(id, user.companyId ?? null);
  }

  @Post(':id/approve')
  @Permissions('purchase_order.approve')
  @ApiOkResponse({ description: 'اعتماد أمر الشراء' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.orders.approve(id, user);
  }

  @Post(':id/cancel')
  @Permissions('purchase_order.approve')
  @ApiOkResponse({ description: 'إلغاء أمر الشراء (سبب إلزامي)' })
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelPurchaseOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, dto, user);
  }

  @Post(':id/receive')
  @Permissions('purchase_order.approve')
  @ApiOkResponse({ description: 'استلام أمر الشراء وإنشاء بيان توريد مرتبط' })
  receive(@Param('id', ParseIntPipe) id: number, @Body() dto: ReceivePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.receive(id, dto, user);
  }
}