import { Module } from '@nestjs/common';
import { SupplierReturnsController } from './supplier-returns.controller.js';
import { SupplierReturnsService } from './supplier-returns.service.js';

@Module({
  controllers: [SupplierReturnsController],
  providers: [SupplierReturnsService],
})
export class SupplierReturnsModule {}