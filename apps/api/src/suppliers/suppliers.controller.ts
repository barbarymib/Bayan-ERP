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
import { CreateSupplierDto, QuerySuppliersDto, UpdateSupplierDto } from './suppliers.dto.js';
import { SuppliersService } from './suppliers.service.js';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة الموردين' })
  list(@Query() query: QuerySuppliersDto, @CurrentUser() user: AuthUser) {
    return this.suppliers.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل مورد' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.suppliers.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('supplier.manage')
  @ApiOkResponse({ description: 'إنشاء مورد' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.suppliers.create(dto, user.companyId ?? null, user.id);
  }

  @Patch(':id')
  @Permissions('supplier.manage')
  @ApiOkResponse({ description: 'تعديل مورد' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto, @CurrentUser() user: AuthUser) {
    return this.suppliers.update(id, dto, user.companyId ?? null, user.id);
  }

  @Delete(':id')
  @Permissions('supplier.manage')
  @ApiOkResponse({ description: 'إيقاف مورد (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.suppliers.remove(id, user.companyId ?? null, user.id);
  }
}