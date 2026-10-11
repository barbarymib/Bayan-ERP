import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  CreatePaymentDto,
  CreateReceiptDto,
  QueryReceiptsDto,
  QueryStatementOfAccountDto,
  UpdateChequeStatusDto,
} from './collections.dto.js';
import { CollectionsService } from './collections.service.js';

@ApiTags('collections')
@ApiBearerAuth()
@Controller()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Post('receipts')
  @Permissions('collection.create')
  @ApiOkResponse({ description: 'سند قبض: قيد دائن على العميل + ربط ببيان أو على الحساب' })
  createReceipt(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthUser) {
    return this.collections.createReceipt(dto, user);
  }

  @Get('receipts')
  @Permissions('collection.create', 'ledger.view')
  @ApiOkResponse({ description: 'قائمة سندات القبض' })
  listReceipts(@Query() query: QueryReceiptsDto, @CurrentUser() user: AuthUser) {
    return this.collections.listReceipts(query, user.companyId ?? null);
  }

  @Get('receipts/:id')
  @Permissions('collection.create', 'ledger.view')
  @ApiOkResponse({ description: 'تفاصيل سند قبض' })
  getReceipt(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.collections.getReceipt(id, user.companyId ?? null);
  }

  @Post('payments')
  @Permissions('collection.create')
  @ApiOkResponse({ description: 'سند صرف: قيد مدين على المورد' })
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.collections.createPayment(dto, user);
  }

  @Get('payments')
  @Permissions('collection.create', 'ledger.view')
  @ApiOkResponse({ description: 'قائمة سندات الصرف' })
  listPayments(@Query() query: { supplierId?: number; limit?: number }, @CurrentUser() user: AuthUser) {
    return this.collections.listPayments(query, user.companyId ?? null);
  }

  @Post('cheques/:id/status')
  @Permissions('collection.create')
  @ApiOkResponse({ description: 'تحديث حالة شيك (محصل / مرتد)' })
  updateCheque(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChequeStatusDto, @CurrentUser() user: AuthUser) {
    return this.collections.updateChequeStatus(id, dto, user.companyId ?? null, user.id);
  }

  @Get('cheques')
  @Permissions('collection.create', 'ledger.view')
  @ApiOkResponse({ description: 'حافظة الشيكات' })
  listCheques(@Query() query: { status?: 'UNDER_COLLECTION' | 'COLLECTED' | 'RETURNED'; limit?: number }, @CurrentUser() user: AuthUser) {
    return this.collections.listCheques(query, user.companyId ?? null);
  }

  @Get('customers/:id/statement')
  @Permissions('ledger.view', 'report.view')
  @ApiOkResponse({ description: 'كشف حساب عميل: رصيد افتتاحي + حركات + مستحقات البيانات' })
  customerStatement(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryStatementOfAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.customerStatement(id, query, user.companyId ?? null);
  }

  @Get('suppliers/:id/statement')
  @Permissions('ledger.view', 'report.view')
  @ApiOkResponse({ description: 'كشف حساب مورد: رصيد افتتاحي + حركات + مستحقات بيانات التوريد' })
  supplierStatement(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryStatementOfAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.collections.supplierStatement(id, query, user.companyId ?? null);
  }
}