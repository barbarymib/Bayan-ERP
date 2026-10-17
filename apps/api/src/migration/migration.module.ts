import { Module } from '@nestjs/common';
import { BackupsModule } from '../backups/backups.module.js';
import { MigrationController } from './migration.controller.js';
import { MigrationService } from './migration.service.js';

@Module({
  imports: [BackupsModule],
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}