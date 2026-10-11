import { Module } from '@nestjs/common';
import { PriceListsController } from './price-lists.controller.js';
import { PriceListsService } from './price-lists.service.js';

@Module({
  controllers: [PriceListsController],
  providers: [PriceListsService],
})
export class PriceListsModule {}