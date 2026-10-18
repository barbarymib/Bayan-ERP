import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/auth.decorators.js';
import { PrismaService } from './prisma/prisma.module.js';
import {
  checkMigrations,
  fetchAppliedMigrations,
  resolveMigrationsDir,
} from './migrations-check/migrations-check.js';

export interface HealthResponse {
  status: string;
  version: string;
  time: string;
  migrations?: { total: number; applied: number; pending: string[] };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOkResponse({ type: Object })
  async check(): Promise<HealthResponse> {
    const migrationsDir = resolveMigrationsDir();
    const applied = await fetchAppliedMigrations(async (sql) =>
      this.prisma.$queryRawUnsafe(sql) as Promise<{ migration_name: string }[]>,
    );
    const status = checkMigrations(migrationsDir, applied);
    return {
      status: status.ok ? 'ok' : 'degraded',
      version: process.env.APP_VERSION ?? '0.1.0',
      time: new Date().toISOString(),
      migrations: {
        total: status.totalOnDisk,
        applied: status.applied,
        pending: status.pending,
      },
    };
  }
}
