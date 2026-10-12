import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { DevicesService } from './devices.service.js';

@ApiTags('devices')
@ApiBearerAuth()
@Permissions('device.manage')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @ApiOkResponse({ description: 'أجهزة الشركة المسجّلة وحالتها' })
  list(@CurrentUser() user: AuthUser) {
    return this.devices.list(user.companyId ?? null);
  }

  @Post(':id/revoke')
  @ApiOkResponse({ description: 'إبطال جهاز (يقطع مزامنته فوراً)' })
  revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.devices.setActive(id, false, user.companyId ?? null, user.username ?? user.name);
  }

  @Post(':id/activate')
  @ApiOkResponse({ description: 'إعادة تفعيل جهاز' })
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.devices.setActive(id, true, user.companyId ?? null, user.username ?? user.name);
  }
}
