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
  CancelStatementDto,
  CreateStatementDto,
  QueryStatementsDto,
  UpdateStatementDto,
} from './price-statements.dto.js';
import { PriceStatementsService } from './price-statements.service.js';

@ApiTags('price-statements')
@ApiBearerAuth()
@Controller('price-statements')
export class PriceStatementsController {
  constructor(private readonly statements: PriceStatementsService) {}

  @Post()
  @Permissions('statement.create')
  @ApiOkResponse({ description: 'إنشاء بيان أسعار (اعتماد مباشر أو طلب موافقة عند تجاوز الحد)' })
  create(@Body() dto: CreateStatementDto, @CurrentUser() user: AuthUser) {
    return this.statements.create(dto, user);
  }

  @Get()
  @Permissions('statement.create', 'report.view')
  @ApiOkResponse({ description: 'قائمة البيانات مع فلاتر' })
  list(@Query() query: QueryStatementsDto, @CurrentUser() user: AuthUser) {
    return this.statements.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('statement.create', 'report.view')
  @ApiOkResponse({ description: 'تفاصيل كشف حساب مع الموافقات' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.statements.get(id, user);
  }

  @Patch(':id')
  @Permissions('statement.edit')
  @ApiOkResponse({
    description:
      'تعديل بيان: مسودة بصلاحية statement.edit، أو بيان معتمد بصلاحية statement.edit_approved (يحفظ نسخة في statement_revisions ويعكس ثم يعيد ترحيل الأثر)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statements.update(id, dto, user);
  }

  @Delete(':id/cancel')
  @Permissions('statement.edit')
  @ApiOkResponse({ description: 'إلغاء بيان (سبب إلزامي) وعكس أثر المخزون/الحساب' })
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelStatementDto, @CurrentUser() user: AuthUser) {
    return this.statements.cancel(id, dto, user);
  }
}