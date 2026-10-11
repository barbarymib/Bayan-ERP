import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/auth.decorators.js';
import { QueryAuditLogsDto } from './audit-logs.dto.js';
import { AuditLogsService } from './audit-logs.service.js';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audits: AuditLogsService) {}

  @Get()
  @Permissions('audit.view')
  @ApiOkResponse({ description: 'سجل العمليات (من فعل ماذا ومتى) §5.14/§9' })
  list(@Query() query: QueryAuditLogsDto) {
    return this.audits.list(query);
  }
}