import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.decorators.js';
import { SyncService } from './sync.service.js';
import { DeviceRegisterDto, PushDto, ReserveBlockDto } from './sync.dto.js';

/**
 * قناة مزامنة تطبيق المناديب (§5.12).
 * كل المسارات تتطلب تسجيل دخول + صلاحية sync.use؛ الجهاز يُربط بمستخدم واحد.
 */
@ApiTags('sync')
@ApiBearerAuth()
@Permissions('sync.use')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('device/register')
  register(@CurrentUser() user: AuthUser, @Body() dto: DeviceRegisterDto) {
    return this.sync.registerDevice(user, dto);
  }

  @Get('delta')
  delta(@CurrentUser() user: AuthUser, @Query('since') since?: string) {
    return this.sync.delta(user, since);
  }

  @Post('push')
  push(@CurrentUser() user: AuthUser, @Body() dto: PushDto) {
    if (!dto.items?.length) throw new BadRequestException('items is required');
    return this.sync.push(user, dto);
  }

  @Post('blocks')
  blocks(@CurrentUser() user: AuthUser, @Body() dto: ReserveBlockDto) {
    return this.sync.reserveBlocks(user, dto);
  }
}