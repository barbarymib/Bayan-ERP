import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public } from './auth.decorators.js';
import { AuthService, type AuthSession, type LoginInput } from './auth.service.js';
import { FeaturesService } from './features.service.js';
import type { AuthUser } from './auth.decorators.js';

export class LoginDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly featuresSvc: FeaturesService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOkResponse({ description: 'رمز الوصول + رمز التحديث + هوية المستخدم وصلاحياته' })
  async login(@Body() dto: LoginDto): Promise<AuthSession> {
    return this.auth.login(dto as LoginInput);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @ApiOkResponse({ description: 'زوج رموز جديد من رمز التحديث' })
  async refresh(@Body() dto: RefreshDto): Promise<AuthSession> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'هوية المستخدم الحالي من التوكن' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('features')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'الميزات الفعّالة للمستخدم/الشركة الحاليَّين (§12.3)' })
  features(@CurrentUser() user: AuthUser): Promise<Record<string, boolean>> {
    return this.featuresSvc.effectiveFlags(user.sub ?? null, user.companyId ?? null);
  }
}
