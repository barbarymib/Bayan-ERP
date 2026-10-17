import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Features, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { ArchiveConfirmDto, ArchiveRangeDto, ArchiveRestoreDto, ArchiveViewerQueryDto } from './archives.dto.js';
import { ArchivesService } from './archives.service.js';

@ApiTags('archives')
@ApiBearerAuth()
@Features('archiving.core')
@Permissions('archive.run')
@Controller('archives')
export class ArchivesController {
  constructor(private readonly archives: ArchivesService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'تذكير دوري + آخر ترحيل' })
  summary() {
    return this.archives.summary();
  }

  @Get()
  @ApiOkResponse({ description: 'سجل عمليات الترحيل' })
  list() {
    return this.archives.list();
  }

  @Post('prechecks')
  @ApiOkResponse({ description: 'فحوصات ما قبل الترحيل دون تنفيذ' })
  prechecks(@Body() dto: ArchiveRangeDto) {
    return this.archives.prechecks(dto.fromDate, dto.toDate);
  }

  @Post('run')
  @ApiOkResponse({ description: 'نسخة احتياطية + تصدير الحزمة + مطابقة (دون حذف)' })
  run(@Body() dto: ArchiveRangeDto, @CurrentUser() user: AuthUser) {
    return this.archives.run(dto, user.id);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.archives.get(id);
  }

  @Get(':id/bundle')
  async bundle(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const { stream, name } = await this.archives.bundleStream(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    stream.pipe(res);
  }

  @Get(':id/data')
  viewer(@Param('id', ParseIntPipe) id: number, @Query() query: ArchiveViewerQueryDto) {
    return this.archives.viewerData(id, query);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Body() dto: ArchiveConfirmDto, @CurrentUser() user: AuthUser) {
    return this.archives.confirm(id, dto.confirmText, dto.bundleSaved, user.id, dto.bundleLocation, dto.startNewNumbering);
  }

  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number, @Body() dto: ArchiveRestoreDto, @CurrentUser() user: AuthUser) {
    return this.archives.restore(id, dto.confirmText, user.id);
  }
}
