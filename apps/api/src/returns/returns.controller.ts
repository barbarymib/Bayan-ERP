import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CreateReturnDto, QueryReturnsDto } from './returns.dto.js';
import { ReturnsService } from './returns.service.js';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @Permissions('return.create')
  @ApiOkResponse({ description: 'إنشاء مرتجع مرتبط ببيان البيع الأصلي (اعتماد أو طلب موافقة)' })
  create(@Body() dto: CreateReturnDto, @CurrentUser() user: AuthUser) {
    return this.returns.create(dto, user);
  }

  @Get()
  @Permissions('return.create', 'report.view')
  @ApiOkResponse({ description: 'قائمة المرتجعات' })
  list(@Query() query: QueryReturnsDto, @CurrentUser() user: AuthUser) {
    return this.returns.list(query, user);
  }

  @Get(':id')
  @Permissions('return.create', 'report.view')
  @ApiOkResponse({ description: 'تفاصيل مرتجع بخطوطه' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.returns.get(id, user.companyId ?? null, user);
  }

  @Delete(':id/cancel')
  @Permissions('return.create')
  @ApiOkResponse({ description: 'إلغاء مرتجع (قبل الاعتماد فقط)' })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.returns.cancel(id, user);
  }
}