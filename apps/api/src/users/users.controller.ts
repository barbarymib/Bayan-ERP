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
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  ChangePasswordDto,
  CreateUserDto,
  QueryUsersDto,
  UpdateRoleLimitsDto,
  UpdateRolePermissionsDto,
  UpdateSelfProfileDto,
  UpdateUserDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me/profile')
  @ApiOkResponse({ description: 'الملف الشخصي للمستخدم الحالي' })
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id, user.companyId ?? null);
  }

  @Patch('me/profile')
  @ApiOkResponse({ description: 'تعديل الملف الشخصي للمستخدم الحالي' })
  updateMyProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateSelfProfileDto) {
    return this.users.updateProfile(user.id, dto, user.companyId ?? null);
  }

  @Post('me/change-password')
  @ApiOkResponse({ description: 'تغيير كلمة مرور المستخدم الحالي' })
  changeMyPassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto, user.companyId ?? null);
  }

  @Get()
  @Permissions('user.view')
  @ApiOkResponse({ description: 'قائمة المستخدمين' })
  list(@Query() query: QueryUsersDto, @CurrentUser() user: AuthUser) {
    return this.users.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('user.view')
  @ApiOkResponse({ description: 'تفاصيل مستخدم' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.users.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'إنشاء مستخدم (مع حدود الخصم)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user.id, user.companyId ?? null);
  }

  @Patch(':id')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'تعديل مستخدم / حدود الخصم' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.update(id, dto, user.id, user.companyId ?? null);
  }

  @Delete(':id')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'إيقاف مستخدم (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user.id, user.roleCode === 'ADMIN', user.companyId ?? null);
  }
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('user.view')
  @ApiOkResponse({ description: 'قائمة الأدوار وصلاحياتها' })
  list() {
    return this.users.listRoles();
  }

  @Put(':id/permissions')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'استبدال صلاحيات دور (دور ADMIN محمي)' })
  updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateRolePermissions(id, dto.permissionCodes, user.id);
  }

  @Put(':id/limits')
  @Permissions('user.manage')
  @ApiOkResponse({ description: 'ضبط حدود الخصم الافتراضية لدور (§4.2؛ دور ADMIN محمي)' })
  updateLimits(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleLimitsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateRoleLimits(id, dto, user.id);
  }
}

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('user.view')
  @ApiOkResponse({ description: 'كتالوج الصلاحيات الكامل' })
  list() {
    return this.users.listPermissions();
  }
}