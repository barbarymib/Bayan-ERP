import { Module } from '@nestjs/common';
import { RepTargetsController } from './rep-targets.controller.js';
import { RepTargetsService } from './rep-targets.service.js';

@Module({
  controllers: [RepTargetsController],
  providers: [RepTargetsService],
})
export class RepTargetsModule {}
