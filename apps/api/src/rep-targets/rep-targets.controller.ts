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
  CommissionReportDto,
  CreateRepTargetDto,
  QueryRepTargetsDto,
  UpdateRepTargetDto,
} from './rep-targets.dto.js';
import { RepTargetsService } from './rep-targets.service.js';

@ApiTags('rep-targets')
@ApiBearerAuth()
@Controller('rep-targets')
export class RepTargetsController {
  constructor(private readonly targets: RepTargetsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة تارجت المناديب (§5.16)' })
  list(@Query() query: QueryRepTargetsDto, @CurrentUser() user: AuthUser) {
    return this.targets.list(query, user.companyId ?? null);
  }

  @Get('report')
  @Permissions('report.view')
  @ApiOkResponse({ description: 'تقرير التارجت والعمولات المحسوبة آلياً' })
  report(@Query() dto: CommissionReportDto, @CurrentUser() user: AuthUser) {
    return this.targets.report(dto, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل تارجت مندوب' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.targets.get(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'إنشاء تارجت لمندوب' })
  create(@Body() dto: CreateRepTargetDto, @CurrentUser() user: AuthUser) {
    return this.targets.create(dto, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'تعديل تارجت' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRepTargetDto, @CurrentUser() user: AuthUser) {
    return this.targets.update(id, dto, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'حذف تارجت' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.targets.remove(id, user.companyId ?? null);
  }

  @Post(':id/recalculate')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'إعادة حساب الإنجاز والعمولة آلياً' })
  recalculate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.targets.recalculate(id, user.companyId ?? null);
  }
}
