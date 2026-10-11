import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { PricesController } from './prices.controller.js';
import { PricesService } from './prices.service.js';

@Module({
  imports: [AuditLogsModule],
  controllers: [PricesController],
  providers: [PricesService],
})
export class PricesModule {}