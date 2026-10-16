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
import { BatchesService } from './batches.service.js';
import { CreateBatchDto, QueryBatchesDto, UpdateBatchDto } from './batches.dto.js';

@ApiTags('batches')
@ApiBearerAuth()
@Controller('batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة دفعات الأصناف (تصفية بالصنف/الانتهاء)' })
  list(@Query() query: QueryBatchesDto, @CurrentUser() user: AuthUser) {
    return this.batches.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل دفعة' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.batches.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إنشاء/تحديث دفعة (كود + صلاحية)' })
  create(@Body() dto: CreateBatchDto, @CurrentUser() user: AuthUser) {
    return this.batches.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعديل دفعة' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBatchDto, @CurrentUser() user: AuthUser) {
    return this.batches.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'حذف دفعة (بلا رصيد/حركات)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.batches.remove(id, user.companyId ?? null);
  }
}
