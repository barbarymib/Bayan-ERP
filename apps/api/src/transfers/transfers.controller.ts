import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CreateTransferDto, QueryTransfersDto } from './transfers.dto.js';
import { TransfersService } from './transfers.service.js';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Post()
  @Permissions('transfer.execute')
  @ApiOkResponse({ description: 'إنشاء تحويل مخزني (خصم من المصدر وإضافة للوجهة)' })
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {
    return this.transfers.create(dto, user);
  }

  @Get()
  @Permissions('transfer.view')
  @ApiOkResponse({ description: 'قائمة التحويلات المخزنية' })
  list(@Query() query: QueryTransfersDto, @CurrentUser() user: AuthUser) {
    return this.transfers.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('transfer.view')
  @ApiOkResponse({ description: 'تفاصيل تحويل مخزني' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.transfers.get(id, user.companyId ?? null);
  }
}