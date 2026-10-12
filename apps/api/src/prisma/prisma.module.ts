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
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

    // عميل "خام" نظيف يفتح المعاملات بسياسات أصلية (بدون توسعة RLS) حتى لا تتداخل
    // الوكلاء الملتفّون عند بدء معاملة من داخل نفسها. (تجمّع super لا يفتح اتصالات
    // لأن كل أساليبه الصالحة تُستبدل بتلك القادمة من العميل الملتفّ.)
    const raw = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    const rawTransaction = raw.$transaction.bind(raw) as RawTransaction;
    const rawExecuteRaw = raw.$executeRaw.bind(raw) as RawExecuteRaw;
    const extended = raw.$extends(
      tenantRlsExtension({ runTransaction: rawTransaction as never }),
    ) as unknown as PrismaClient;

    // ننسخ من العميل الملتفّ الأساليب والوكلاء فقط (لا الخصائص الداخلية '_...').
    const target = this as unknown as Record<string, unknown>;
    for (const key of Object.keys(extended as unknown as object)) {
      if (!key.startsWith('_')) target[key] = (extended as unknown as Record<string, unknown>)[key];
    }

    target.$transaction = ((arg: unknown, options?: unknown) => {
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