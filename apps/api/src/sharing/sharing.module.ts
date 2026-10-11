import { Module } from '@nestjs/common';
import { LabelingController } from './labeling.controller.js';
import { LabelingService } from './labeling.service.js';
import { WhatsAppController } from './whatsapp.controller.js';
import { WhatsAppService } from './whatsapp.service.js';

@Module({
  controllers: [LabelingController, WhatsAppController],
  providers: [LabelingService, WhatsAppService],
})
export class SharingModule {}
