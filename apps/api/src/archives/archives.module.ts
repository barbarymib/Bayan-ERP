import { Module } from '@nestjs/common';
import { ArchivesController } from './archives.controller.js';
import { ArchivesService } from './archives.service.js';

@Module({
  controllers: [ArchivesController],
  providers: [ArchivesService],
})
export class ArchivesModule {}
