import { Global, Module } from '@nestjs/common';
import { NumberingService } from '../numbering.service.js';
import { PeriodsService } from './periods.service.js';
import { StockService } from './stock.service.js';
import { LedgerService } from './ledger.service.js';
import { SalesOpsService } from './sales-ops.service.js';
import { PriceResolverService } from './price-resolver.service.js';

@Global()
@Module({
  providers: [
    NumberingService,
    PeriodsService,
    StockService,
    LedgerService,
    SalesOpsService,
    PriceResolverService,
  ],
  exports: [
    NumberingService,
    PeriodsService,
    StockService,
    LedgerService,
    SalesOpsService,
    PriceResolverService,
  ],
})
export class CommonModule {}
