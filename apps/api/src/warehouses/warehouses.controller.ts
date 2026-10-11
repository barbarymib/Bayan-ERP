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
import { CreateWarehouseDto, QueryWarehousesDto, UpdateWarehouseDto } from './warehouses.dto.js';
import { WarehousesService } from './warehouses.service.js';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة المخازن' })
  list(@Query() query: QueryWarehousesDto, @CurrentUser() user: AuthUser) {
    return this.warehouses.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل مخزن' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.warehouses.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'إنشاء مخزن' })
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthUser) {
    return this.warehouses.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'تعديل مخزن' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: AuthUser) {
    return this.warehouses.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'إيقاف مخزن (بدون حركات)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.warehouses.remove(id, user.companyId ?? null);
  }
}