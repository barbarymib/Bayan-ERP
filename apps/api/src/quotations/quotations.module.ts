import { Module } from '@nestjs/common';
import { PriceStatementsModule } from '../price-statements/price-statements.module.js';
import { QuotationsController } from './quotations.controller.js';
import { QuotationsService } from './quotations.service.js';

@Module({
  imports: [PriceStatementsModule],
  controllers: [QuotationsController],
  providers: [QuotationsService],
})
export class QuotationsModule {}
