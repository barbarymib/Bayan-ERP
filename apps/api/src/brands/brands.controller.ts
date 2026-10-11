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
import { CreateBrandDto, QueryBrandsDto, UpdateBrandDto } from './brands.dto.js';
import { BrandsService } from './brands.service.js';

@ApiTags('brands')
@ApiBearerAuth()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة الماركات (بحث)' })
  list(@Query() query: QueryBrandsDto, @CurrentUser() user: AuthUser) {
    return this.brands.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل ماركة' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.brands.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إنشاء ماركة' })
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعديل ماركة' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto, @CurrentUser() user: AuthUser) {
    return this.brands.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'حذف ماركة (غير مستخدمة)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.brands.remove(id, user.companyId ?? null);
  }
}
