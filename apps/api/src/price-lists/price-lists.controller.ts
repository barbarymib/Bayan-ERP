import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CreatePriceListDto, QueryPriceListsDto, UpdatePriceListDto } from './price-lists.dto.js';
import { PriceListsService } from './price-lists.service.js';

@ApiTags('price-lists')
@ApiBearerAuth()
@Controller('price-lists')
export class PriceListsController {
  constructor(private readonly priceLists: PriceListsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة قوائم الأسعار' })
  list(@Query() query: QueryPriceListsDto, @CurrentUser() user: AuthUser) {
    return this.priceLists.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل قائمة أسعار' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.priceLists.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'إنشاء قائمة أسعار' })
  create(@Body() dto: CreatePriceListDto, @CurrentUser() user: AuthUser) {
    return this.priceLists.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'تعديل قائمة أسعار' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePriceListDto, @CurrentUser() user: AuthUser) {
    return this.priceLists.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('price.manage')
  @ApiOkResponse({ description: 'حذف قائمة أسعار (فارغة)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.priceLists.remove(id, user.companyId ?? null);
  }
}