import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { currentCompanyId } from '../tenant/tenant.context.js';
import { buildTenantGuc, setTenantGuc, tenantRlsExtension } from '../tenant/prisma-tenant.extension.js';

type RawExecuteRaw = (strings: TemplateStringsArray, ...values: unknown[]) => Prisma.PrismaPromise<number>;
type RawTransaction = (...args: unknown[]) => unknown;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

    // نلتقط النسختين الأصليتين قبل الاستبدال، لتجنّب الالتفاف المتداخل.
    const rawTransaction = this.$transaction.bind(this) as RawTransaction;
    const rawExecuteRaw = this.$executeRaw.bind(this) as RawExecuteRaw;

    const extended = this.$extends(
      tenantRlsExtension({ runTransaction: rawTransaction as never }),
    ) as unknown as PrismaClient;
    Object.assign(this, extended);

    this.$transaction = ((arg: unknown, options?: unknown) => {
      const companyId = currentCompanyId();

      if (typeof arg === 'function') {
        return rawTransaction(
          async (tx: Prisma.TransactionClient) => {
            await setTenantGuc(tx, companyId);
            return (arg as (t: Prisma.TransactionClient) => Promise<unknown>)(tx);
          },
          options,
        );
      }

      if (Array.isArray(arg)) {
        return rawTransaction([buildTenantGuc(rawExecuteRaw, companyId), ...arg], options);
      }

      return rawTransaction(arg, options);
    }) as never;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
