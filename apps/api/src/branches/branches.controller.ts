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
import { CreateBranchDto, QueryBranchesDto, UpdateBranchDto } from './branches.dto.js';
import { BranchesService } from './branches.service.js';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة الفروع (§5.16 تعدّد الفروع)' })
  list(@Query() query: QueryBranchesDto, @CurrentUser() user: AuthUser) {
    return this.branches.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل فرع' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.branches.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'إنشاء فرع' })
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branches.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'تعديل فرع' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branches.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('warehouse.manage')
  @ApiOkResponse({ description: 'حذف فرع (فارغ)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.branches.remove(id, user.companyId ?? null);
  }
}