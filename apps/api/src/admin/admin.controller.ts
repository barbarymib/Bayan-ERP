import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GlobalAdmin, Public, CurrentUser, type AuthUser } from '../auth/auth.decorators.js';
import { AdminService } from './admin.service.js';
import {
  CreateCompanyDto,
  GlobalLoginDto,
  QueryCompaniesDto,
  SetEnabledDto,
  SetUserFeatureDto,
  UpdateCompanyDto,
} from './admin.dto.js';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Post('login')
  @ApiOkResponse({ description: 'دخول المشرف العام للبيئة' })
  login(@Body() dto: GlobalLoginDto) {
    return this.admin.login(dto);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get('companies')
  @ApiOkResponse({ description: 'سجل الشركات مع عدد المستخدمين' })
  listCompanies(@Query() query: QueryCompaniesDto) {
    return this.admin.listCompanies(query);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Post('companies')
  @ApiOkResponse({ description: 'إنشاء شركة جديدة (Onboarding) اختيارياً مع مالكها الأول' })
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.admin.createCompany(dto, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Patch('companies/:id')
  @ApiOkResponse({ description: 'تعديل شركة / تفعيل أو تعطيل' })
  patchCompany(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.admin.patchCompany(id, dto, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get('companies/:id/features')
  @ApiOkResponse({ description: 'ميزات شركة مع استثناءاتها' })
  companyFeatures(@Param('id', ParseIntPipe) id: number) {
    return this.admin.companyFeatures(id);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Put('companies/:id/feature/:code')
  @ApiOkResponse({ description: 'تفعيل/تعطيل ميزة لشركة (استثناء)' })
  setCompanyFeature(
    @Param('id', ParseIntPipe) id: number,
    @Param('code') code: string,
    @Body() dto: SetEnabledDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setCompanyFeature(id, code, dto.enabled, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Delete('companies/:id/feature/:code')
  @ApiOkResponse({ description: 'مسح استثناء ميزة شركة' })
  clearCompanyFeature(@Param('id', ParseIntPipe) id: number, @Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.admin.clearCompanyFeature(id, code, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get('features')
  @ApiOkResponse({ description: 'الميزات العامة للبيئة' })
  listFeatures() {
    return this.admin.listFeatures();
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Patch('features/:code')
  @ApiOkResponse({ description: 'تشغيل/إطفاء ميزة عامة' })
  setGlobalFeature(@Param('code') code: string, @Body() dto: SetEnabledDto, @CurrentUser() user: AuthUser) {
    return this.admin.setGlobalFeature(code, dto.enabled, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Get('features/:code/users')
  @ApiOkResponse({ description: 'مستخدمو الشركات واستثناءاتهم لميزة' })
  featureUsers(@Param('code') code: string) {
    return this.admin.featureUsers(code);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Put('users/:id/feature/:code')
  @ApiOkResponse({ description: 'ضبط ميزة لمستخدم (بدون enabled يمسح الاستثناء)' })
  setUserFeature(
    @Param('id', ParseIntPipe) id: number,
    @Param('code') code: string,
    @Body() dto: SetUserFeatureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setUserFeature(id, code, dto, user.username ?? user.name);
  }

  @GlobalAdmin()
  @ApiBearerAuth()
  @Delete('users/:id/feature/:code')
  @ApiOkResponse({ description: 'مسح استثناء ميزة مستخدم' })
  clearUserFeature(@Param('id', ParseIntPipe) id: number, @Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.admin.setUserFeature(id, code, { enabled: undefined }, user.username ?? user.name);
  }
}