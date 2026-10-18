import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { SetFeatureDto, SetUserFeatureDto, UpdateCompanySettingsDto } from './company.dto.js';
import { CompanyService } from './company.service.js';

@ApiTags('company')
@ApiBearerAuth()
@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  @ApiOkResponse({ description: 'إعدادات الشركة للنطاق الحالي (R3-B15)' })
  getSettings(@CurrentUser() user: AuthUser) {
    return this.company.getSettings(user.companyId ?? null);
  }

  @Patch()
  @Permissions('company.manage')
  @ApiOkResponse({ description: 'تحديث إعدادات الشركة (الضريبة الافتراضية)' })
  updateSettings(@Body() dto: UpdateCompanySettingsDto, @CurrentUser() user: AuthUser) {
    return this.company.updateSettings(user.companyId ?? null, dto, user.sub, user.username ?? user.name);
  }

  // ---- إدارة ميزات الشركة (G17) ----

  @Get('features')
  @Permissions('company.manage')
  @ApiOkResponse({ description: 'ميزات الشركة مع القيمة الفعالة والنطاق (GLOBAL/COMPANY) — G17' })
  listFeatures(@CurrentUser() user: AuthUser) {
    return this.company.listFeatures(user.companyId ?? null);
  }

  @Put('features/:code')
  @Permissions('company.manage')
  @ApiOkResponse({ description: 'ضبط ميزة على مستوى الشركة (يستبدل الحالة العامة) — G17' })
  setFeature(@Param('code') code: string, @Body() dto: SetFeatureDto, @CurrentUser() user: AuthUser) {
    return this.company.setCompanyFeature(user.companyId ?? null, code, dto.enabled, user.sub, user.username ?? user.name);
  }

  @Delete('features/:code')
  @Permissions('company.manage')
  @ApiOkResponse({ description: 'حذف استبدال الشركة للميزة (العودة للحالة العامة) — G17' })
  clearFeature(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.company.clearCompanyFeature(user.companyId ?? null, code, user.sub, user.username ?? user.name);
  }

  @Put('users/:id/feature/:code')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'استبدال ميزة على مستوى مستخدم داخل الشركة — G17' })
  setUserFeature(
    @Param('id', ParseIntPipe) id: number,
    @Param('code') code: string,
    @Body() dto: SetUserFeatureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.company.setUserFeature(user.companyId ?? null, id, code, dto.enabled, user.sub, user.username ?? user.name);
  }

  @Delete('users/:id/feature/:code')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'حذف استبدال ميزة مستخدم (الرجوع للشركة/العام) — G17' })
  clearUserFeature(@Param('id', ParseIntPipe) id: number, @Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.company.setUserFeature(user.companyId ?? null, id, code, undefined, user.sub, user.username ?? user.name);
  }
}
