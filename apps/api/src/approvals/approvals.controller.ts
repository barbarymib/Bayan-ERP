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
import { DecideApprovalDto, QueryApprovalsDto } from './approvals.dto.js';
import { ApprovalsService } from './approvals.service.js';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @Permissions('discount.approve')
  @ApiOkResponse({ description: 'قائمة طلبات الموافقة (الخصومات والمرتجعات)' })
  list(@Query() query: QueryApprovalsDto, @CurrentUser() user: AuthUser) {
    return this.approvals.list(query, user.companyId ?? null);
  }

  @Post(':id/decide')
  @Permissions('discount.approve')
  @ApiOkResponse({ description: 'اعتماد/رفض طلب — عند الاعتماد يُنهى البيان/المرتجع (مخزون+دفتر)' })
  decide(@Param('id', ParseIntPipe) id: number, @Body() dto: DecideApprovalDto, @CurrentUser() user: AuthUser) {
    return this.approvals.decide(id, dto, user);
  }
}