import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CompanyModule } from '../company/company.module.js';
import { PriceStatementsController } from './price-statements.controller.js';
import { PriceStatementsService } from './price-statements.service.js';

@Module({
  imports: [NotificationsModule, CompanyModule],
  controllers: [PriceStatementsController],
  providers: [PriceStatementsService],
  exports: [PriceStatementsService],
})
export class PriceStatementsModule {}