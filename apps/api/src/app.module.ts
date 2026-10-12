import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { TenantContextInterceptor } from './tenant/tenant.interceptor.js';
import { CommonModule } from './common/common.module.js';
import { ObjectStorageModule } from './common/object-storage.module.js';
import { ItemsModule } from './items/items.module.js';
import { UnitsModule } from './units/units.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { PriceListsModule } from './price-lists/price-lists.module.js';
import { PricesModule } from './prices/prices.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { UsersModule } from './users/users.module.js';
import { PriceStatementsModule } from './price-statements/price-statements.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { PurchasesModule } from './purchases/purchases.module.js';
import { CollectionsModule } from './collections/collections.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { StocktakesModule } from './stocktakes/stocktakes.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { GeoModule } from './geo/geo.module.js';
import { ArchivesModule } from './archives/archives.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SyncModule } from './sync/sync.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { QuotationsModule } from './quotations/quotations.module.js';
import { SpecialPricesModule } from './special-prices/special-prices.module.js';
import { RepTargetsModule } from './rep-targets/rep-targets.module.js';
import { SharingModule } from './sharing/sharing.module.js';
import { BackupsModule } from './backups/backups.module.js';
import { MigrationModule } from './migration/migration.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module.js';
import { SupplierReturnsModule } from './supplier-returns/supplier-returns.module.js';
import { TreasuryModule } from './treasury/treasury.module.js';
import { TransfersModule } from './transfers/transfers.module.js';
import { VisitsModule } from './visits/visits.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    PrismaModule,
    CommonModule,
    ObjectStorageModule,
    AuthModule,
    ItemsModule,
    UnitsModule,
    CategoriesModule,
    BrandsModule,
    PriceListsModule,
    PricesModule,
    CustomersModule,
    SuppliersModule,
    WarehousesModule,
    UsersModule,
    PriceStatementsModule,
    ReturnsModule,
    PurchasesModule,
    CollectionsModule,
    ApprovalsModule,
    StocktakesModule,
    ReportsModule,
    GeoModule,
    ArchivesModule,
    AdminModule,
    SyncModule,
    BranchesModule,
    QuotationsModule,
    SpecialPricesModule,
    RepTargetsModule,
    SharingModule,
    BackupsModule,
    MigrationModule,
    NotificationsModule,
    AuditLogsModule,
    TransfersModule,
    PurchaseOrdersModule,
    SupplierReturnsModule,
    TreasuryModule,
    VisitsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
