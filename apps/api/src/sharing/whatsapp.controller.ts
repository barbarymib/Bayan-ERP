import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { WhatsAppService } from './whatsapp.service.js';

class WhatsAppStatementQuery {
  @ApiPropertyOptional({ description: 'من تاريخ' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('whatsapp')
@ApiBearerAuth()
@Permissions('label.view')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('statement/:customerId')
  @ApiOkResponse({ description: 'رابط إرسال كشف الحساب عبر واتساب (§5.16)' })
  statement(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query() query: WhatsAppStatementQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.whatsapp.statementLink(customerId, query.from, query.to, user.companyId ?? null);
  }
}
