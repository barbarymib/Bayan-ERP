import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { UpdateCompanySettingsDto } from './company.dto.js';
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
}
