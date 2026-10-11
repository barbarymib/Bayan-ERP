import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, GlobalAdmin, type AuthUser } from '../auth/auth.decorators.js';
import { SetSettingDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get()
  @ApiOkResponse({ description: 'إعدادات النظام (مفتاح/قيمة)' })
  list() {
    return this.settings.list();
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get(':key')
  @ApiOkResponse({ description: 'قراءة إعداد' })
  get(@Param('key') key: string) {
    return this.settings.get(key);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Put(':key')
  @ApiOkResponse({ description: 'إنشاء/تحديث إعداد' })
  upsert(@Param('key') key: string, @Body() dto: SetSettingDto, @CurrentUser() user: AuthUser) {
    return this.settings.upsert(key, dto.value, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Delete(':key')
  @ApiOkResponse({ description: 'حذف إعداد' })
  remove(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    return this.settings.remove(key, user.username ?? user.name);
  }
}
