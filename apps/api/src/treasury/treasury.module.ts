import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller.js';
import { TreasuryService } from './treasury.service.js';

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService],
})
export class TreasuryModule {}