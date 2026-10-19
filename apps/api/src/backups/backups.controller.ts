import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Permissions } from '../auth/auth.decorators.js';
import { BackupsService } from './backups.service.js';

@ApiTags('backups')
@ApiBearerAuth()
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  @ApiOkResponse({ description: 'سجل النسخ الاحتياطي المشفر (§5.16)' })
  list() {
    return this.backups.list();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل نسخة احتياطية' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.backups.get(id);
  }

  @Post()
  @Permissions('archive.run')
  @ApiOkResponse({ description: 'تشغيل نسخة احتياطية مشفرة فوراً' })
  run(@CurrentUser() user: AuthUser) {
    return this.backups.runBackup(user.id);
  }

  @Post(':id/verify')
  @Permissions('archive.run')
  @ApiOkResponse({ description: 'التحقق من سلامة النسخة وفك تشفيرها (اختبار الاسترجاع)' })
  verify(@Param('id', ParseIntPipe) id: number) {
    return this.backups.verify(id);
  }

  @Post(':id/restore-drill')
  @Permissions('archive.run')
  @ApiOkResponse({
    description: 'اختبار استرجاع فعلي: يستعيد النسخة في قاعدة مؤقتة ويتحقق من البيانات ثم يسقطها (R3-E6)',
  })
  restoreDrill(@Param('id', ParseIntPipe) id: number) {
    return this.backups.restoreDrill(id);
  }
}
