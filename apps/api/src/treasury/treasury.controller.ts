import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  CreateCashAccountDto,
  CreateHandoverDto,
  CustodyReconciliationQueryDto,
  DailyCloseDto,
  QueryHandoversDto,
  UpdateCashAccountDto,
} from './treasury.dto.js';
import type { QueryStatementOfAccountDto } from '../collections/collections.dto.js';
import { TreasuryService } from './treasury.service.js';

@ApiTags('treasury')
@ApiBearerAuth()
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Post('accounts')
  @Permissions('treasury.manage')
  @ApiOkResponse({ description: 'إنشاء حساب خزينة' })
  createAccount(@Body() dto: CreateCashAccountDto, @CurrentUser() user: AuthUser) {
    return this.treasury.createAccount(dto, user);
  }

  @Get('accounts')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'قائمة حسابات الخزينة' })
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.treasury.listAccounts(user.companyId ?? null);
  }

  @Patch('accounts/:id')
  @Permissions('treasury.manage')
  @ApiOkResponse({ description: 'تعديل حساب خزينة' })
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCashAccountDto, @CurrentUser() user: AuthUser) {
    return this.treasury.updateAccount(id, dto, user);
  }

  @Post('handovers')
  @Permissions('cash.handover')
  @ApiOkResponse({ description: 'تسليم عهدة نقدية من مندوب' })
  createHandover(@Body() dto: CreateHandoverDto, @CurrentUser() user: AuthUser) {
    return this.treasury.createHandover(dto, user);
  }

  @Get('handovers')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'قائمة محاضر تسليم العهد' })
  listHandovers(@Query() query: QueryHandoversDto, @CurrentUser() user: AuthUser) {
    return this.treasury.listHandovers(query, user.companyId ?? null);
  }

  @Get('custody-reconciliation')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'مطابقة عهدة المندوب: التحصيل مقابل المُسلَّم للخزينة' })
  custodyReconciliation(@Query() query: CustodyReconciliationQueryDto, @CurrentUser() user: AuthUser) {
    return this.treasury.custodyReconciliation(query, user.companyId ?? null);
  }

  @Get('handovers/:id')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'محضر تسليم عهدة واحد' })
  getHandover(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.treasury.getHandover(id, user.companyId ?? null);
  }

  @Post('daily-close')
  @Permissions('daily_close.execute')
  @ApiOkResponse({ description: 'تنفيذ الإقفال اليومي للخزينة' })
  dailyClose(@Body() dto: DailyCloseDto, @CurrentUser() user: AuthUser) {
    return this.treasury.dailyClose(dto, user);
  }

  @Get('daily-close')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'قائمة الإقفالات اليومية' })
  listDailyCloses(@CurrentUser() user: AuthUser) {
    return this.treasury.listDailyCloses(30, user.companyId ?? null);
  }

  @Get('summary')
  @Permissions('treasury.view')
  @ApiOkResponse({ description: 'ملخص النقدية الحالي' })
  summary(@CurrentUser() user: AuthUser) {
    return this.treasury.cashSummary(user.companyId ?? null);
  }

  @Get('accounts/:id/statement')
  @Permissions('treasury.view', 'ledger.view')
  @ApiOkResponse({ description: 'كشف حساب خزينة: رصيد افتتاحي + حركات + رصيد ختامي' })
  accountStatement(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryStatementOfAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.treasury.accountStatement(id, query, user.companyId ?? null);
  }
}