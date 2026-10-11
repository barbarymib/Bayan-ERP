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
import {
  CreateCustomerGroupDto,
  QueryCustomerGroupsDto,
  UpdateCustomerGroupDto,
} from './special-prices.dto.js';
import { SpecialPricesService } from './special-prices.service.js';

@ApiTags('customer-groups')
@ApiBearerAuth()
@Controller('customer-groups')
export class CustomerGroupsController {
  constructor(private readonly specials: SpecialPricesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة مجموعات العملاء' })
  list(@Query() query: QueryCustomerGroupsDto, @CurrentUser() user: AuthUser) {
    return this.specials.listGroups(query, user.companyId ?? null);
  }

  @Post()
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'إنشاء مجموعة عملاء' })
  create(@Body() dto: CreateCustomerGroupDto, @CurrentUser() user: AuthUser) {
    return this.specials.createGroup(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'تعديل مجموعة عملاء' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerGroupDto, @CurrentUser() user: AuthUser) {
    return this.specials.updateGroup(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('customer.manage')
  @ApiOkResponse({ description: 'حذف مجموعة عملاء (فارغة)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.specials.removeGroup(id, user.companyId ?? null);
  }
}
