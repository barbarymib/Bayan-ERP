import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { DeviceGuard } from '../auth/device.guard.js';
import { PriceStatementsModule } from '../price-statements/price-statements.module.js';
import { ReturnsModule } from '../returns/returns.module.js';
import { CollectionsModule } from '../collections/collections.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StocktakesModule } from '../stocktakes/stocktakes.module.js';

@Module({
  imports: [PriceStatementsModule, ReturnsModule, CollectionsModule, NotificationsModule, StocktakesModule],
  controllers: [SyncController],
  providers: [SyncService, DeviceGuard],
})
export class SyncModule {}