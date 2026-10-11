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
import { AuthUser, CurrentUser, Permissions } from '../auth/auth.decorators.js';
import {
  CreateQuotationDto,
  QueryQuotationsDto,
  QuotationActionDto,
} from './quotations.dto.js';
import { QuotationsService } from './quotations.service.js';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة عروض الأسعار (§5.16)' })
  list(@Query() query: QueryQuotationsDto, @CurrentUser() user: AuthUser) {
    return this.quotations.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل عرض سعر' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.quotations.get(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('statement.create')
  @ApiOkResponse({ description: 'إنشاء عرض سعر' })
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotations.create(dto, user);
  }

  @Post(':id/send')
  @Permissions('statement.create')
  @ApiOkResponse({ description: 'إرسال عرض السعر للعميل' })
  send(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.quotations.send(id, user.id, user.companyId ?? null);
  }

  @Post(':id/accept')
  @Permissions('statement.approve')
  @ApiOkResponse({ description: 'قبول عرض السعر' })
  accept(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuotationActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotations.accept(id, dto, user);
  }

  @Post(':id/reject')
  @Permissions('statement.approve')
  @ApiOkResponse({ description: 'رفض عرض السعر' })
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: QuotationActionDto, @CurrentUser() user: AuthUser) {
    return this.quotations.reject(id, dto, user.id, user.companyId ?? null);
  }

  @Post(':id/convert')
  @Permissions('statement.create')
  @ApiOkResponse({ description: 'تحويل عرض السعر إلى بيان أسعار بضغطة' })
  convert(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.quotations.convert(id, user);
  }
}
