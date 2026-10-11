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
import { CreateCustomerDto, QueryCustomersDto, UpdateCustomerDto } from './customers.dto.js';
import { CustomersService } from './customers.service.js';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة العملاء (بحث/تصفية/ترقيم صفحات)' })
  list(@Query() query: QueryCustomersDto, @CurrentUser() user: AuthUser) {
    return this.customers.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل عميل' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.customers.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'إنشاء عميل (بحد ائتماني/مندوب)' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'تعديل عميل' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'إيقاف عميل (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.customers.remove(id, user.companyId ?? null);
  }
}