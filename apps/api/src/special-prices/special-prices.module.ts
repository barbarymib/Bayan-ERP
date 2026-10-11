import { Module } from '@nestjs/common';
import { CustomerGroupsController } from './customer-groups.controller.js';
import { SpecialPricesController } from './special-prices.controller.js';
import { SpecialPricesService } from './special-prices.service.js';

@Module({
  controllers: [SpecialPricesController, CustomerGroupsController],
  providers: [SpecialPricesService],
})
export class SpecialPricesModule {}
