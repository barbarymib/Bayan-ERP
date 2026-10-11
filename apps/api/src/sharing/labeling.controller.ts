import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { LabelingService } from './labeling.service.js';

@ApiTags('labels')
@ApiBearerAuth()
@Permissions('label.view')
@Controller('labels')
export class LabelingController {
  constructor(private readonly labels: LabelingService) {}

  @Get('qr/item/:code')
  @Header('Content-Type', 'image/svg+xml')
  itemQr(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.labels.itemQr(code, user.companyId ?? null);
  }

  @Get('qr/customer/:code')
  @Header('Content-Type', 'image/svg+xml')
  customerQr(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.labels.customerQr(code, user.companyId ?? null);
  }

  @Get('barcode/item/:code')
  @Header('Content-Type', 'image/svg+xml')
  itemBarcode(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.labels.itemBarcode(code, user.companyId ?? null);
  }
}
