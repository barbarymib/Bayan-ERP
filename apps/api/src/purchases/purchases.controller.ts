import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import { CreatePurchaseDto, QueryPurchasesDto } from './purchases.dto.js';
import { PurchasesService } from './purchases.service.js';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post()
  @Permissions('statement.create')
  @ApiOkResponse({ description: 'إنشاء بيان توريد: استلام للمخزن + تحديث آخر سعر شراء + قيد مورد' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: AuthUser) {
    return this.purchases.create(dto, user);
  }

  @Get()
  @Permissions('statement.create', 'report.view')
  @ApiOkResponse({ description: 'قائمة بيانات التوريد' })
  list(@Query() query: QueryPurchasesDto, @CurrentUser() user: AuthUser) {
    return this.purchases.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('statement.create', 'report.view')
  @ApiOkResponse({ description: 'تفاصيل بيان توريد' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.purchases.get(id, user.companyId ?? null);
  }
}