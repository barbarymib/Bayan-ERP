import 'reflect-metadata';
import 'dotenv/config';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.module.js';
import { runWithTenant } from './tenant/tenant.context.js';
import {
  checkMigrations,
  fetchAppliedMigrations,
  resolveMigrationsDir,
} from './migrations-check/migrations-check.js';

/**
 * §12.5 boot-time migration check (GAP G24): refuses to serve until every Prisma
 * migration on disk has been applied. Opt out with SKIP_MIGRATION_CHECK=1.
 */
async function assertMigrationsApplied(app: Awaited<ReturnType<typeof NestFactory.create>>): Promise<void> {
  if (process.env.SKIP_MIGRATION_CHECK === '1') return;

  const migrationsDir = resolveMigrationsDir();
  const prisma = app.get(PrismaService);
  const applied = await fetchAppliedMigrations(async (sql) =>
    prisma.$queryRawUnsafe(sql) as Promise<{ migration_name: string }[]>,
  );
  const status = checkMigrations(migrationsDir, applied);

  if (!status.ok) {
    console.error(
      `[boot] Pending Prisma migrations (${status.pending.length}/${status.totalOnDisk}): ` +
        status.pending.join(', '),
    );
    console.error('[boot] Run `npm run db:deploy` (or set SKIP_MIGRATION_CHECK=1 to bypass).');
    process.exit(1);
  }
  console.log(`[boot] migrations ok (${status.applied}/${status.totalOnDisk} applied)`);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // سياق المستأجر (§12): يبدأ فارغًا لكل طلب، ويُملأ بعد المصادقة في الاعتراض.
  app.use((_req: unknown, _res: unknown, next: () => void) => {
    runWithTenant({ companyId: null }, () => next());
  });
  // أمان HTTP (§9): ترويسات الحماية؛ CSP كامل في الإنتاج فقط حتى لا يتعطل Swagger في التطوير.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );

  // CORS: قائمة أصول صريحة عبر CORS_ORIGINS؛ في غير الإنتاج نسمح بالأصل المُرسل.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: false });
  } else if (process.env.NODE_ENV !== 'production') {
    app.enableCors({ origin: true, credentials: false });
  }

  // Swagger: غير مكشوف في الإنتاج إلا بتفعيل صريح.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Bayan API')
      .setDescription('بيان — نظام مبيعات الحدايد والبويات')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await assertMigrationsApplied(app);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Bayan API: http://${host}:${port}/api/health`);
}

bootstrap();
