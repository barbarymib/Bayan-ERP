import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CreateSupplierReturnDto, QuerySupplierReturnsDto } from './supplier-returns.dto.js';
import { SupplierReturnsService } from './supplier-returns.service.js';

@ApiTags('supplier-returns')
@ApiBearerAuth()
@Controller('supplier-returns')
export class SupplierReturnsController {
  constructor(private readonly returns: SupplierReturnsService) {}

  @Post()
  @Permissions('supplier_return.create')
  @ApiOkResponse({ description: 'إنشاء مرتجع مشتريات (صرف من المخزن وتخفيض مديونية المورد)' })
  create(@Body() dto: CreateSupplierReturnDto, @CurrentUser() user: AuthUser) {
    return this.returns.create(dto, user);
  }

  @Get()
  @Permissions('supplier_return.view')
  @ApiOkResponse({ description: 'قائمة مرتجعات المشتريات' })
  list(@Query() query: QuerySupplierReturnsDto, @CurrentUser() user: AuthUser) {
    return this.returns.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('supplier_return.view')
  @ApiOkResponse({ description: 'تفاصيل مرتجع مشتريات' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.returns.get(id, user.companyId ?? null);
  }
}