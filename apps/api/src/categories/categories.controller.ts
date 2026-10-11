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
import { CreateCategoryDto, QueryCategoriesDto, UpdateCategoryDto } from './categories.dto.js';
import { CategoriesService } from './categories.service.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة التصنيفات (بحث/تصفية)' })
  list(@Query() query: QueryCategoriesDto, @CurrentUser() user: AuthUser) {
    return this.categories.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل تصنيف' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.categories.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إنشاء تصنيف' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.categories.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعديل تصنيف' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.categories.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'حذف تصنيف (فارغ)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.categories.remove(id, user.companyId ?? null);
  }
}