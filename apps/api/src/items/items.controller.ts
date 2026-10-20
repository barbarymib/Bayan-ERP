import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { ItemsService } from './items.service.js';
import { CreateItemDto, QueryItemsDto, UpdateItemDto, UploadItemImageDto } from './items.dto.js';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @ApiOkResponse({ description: 'قائمة الأصناف (بحث/ترقيم صفحات)' })
  list(@Query() query: QueryItemsDto, @CurrentUser() user: AuthUser) {
    return this.items.list(query, user.companyId ?? null);
  }

  @Get(':id/convert')
  @ApiOkResponse({ description: 'تحويل كمية بين وحدات صنف' })
  convert(
    @Param('id', ParseIntPipe) id: number,
    @Query('qty') qty: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthUser,
  ) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) throw new BadRequestException('qty must be a non-negative number');
    if (!from || !to) throw new BadRequestException('from and to are required');
    return this.items.convert(id, from, to, n, user.companyId ?? null);
  }

  @Get(':id/variants')
  @ApiOkResponse({ description: 'تنويعات الصنف الأساسي' })
  variants(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.items.variants(id, user.companyId ?? null);
  }

  @Post(':id/image')
  @Permissions('item.manage')
  @ApiCreatedResponse({ description: 'رفع صورة الصنف (data URL base64) — §5.1' })
  uploadImage(@Param('id', ParseIntPipe) id: number, @Body() dto: UploadItemImageDto, @CurrentUser() user: AuthUser) {
    return this.items.uploadImage(id, dto.dataUrl, user.companyId ?? null, user.id);
  }

  @Delete(':id/image')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إزالة صورة الصنف' })
  removeImage(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.items.clearImage(id, user.companyId ?? null, user.id);
  }

  @Get(':id/image')
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOkResponse({ description: 'صورة الصنف (تمرير data URL، تحويل روابط http، أو تحميل من التخزين)' })
  async image(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const src = await this.items.getImageSource(id, user.companyId ?? null);
    if (src.kind === 'redirect') {
      res.redirect(src.url);
      return;
    }
    res.header('Content-Type', src.mime).send(src.buffer);
  }

  @Post(':id/images')
  @Permissions('item.manage')
  @ApiCreatedResponse({ description: 'رفع صورة إلى معرض الصنف (§5.1 · R4-C2)' })
  uploadGalleryImage(@Param('id', ParseIntPipe) id: number, @Body() dto: UploadItemImageDto, @CurrentUser() user: AuthUser) {
    return this.items.uploadGalleryImage(id, dto.dataUrl, user.companyId ?? null, user.id);
  }

  @Delete(':id/images/:imageId')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'إزالة صورة من معرض الصنف' })
  removeGalleryImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.items.removeGalleryImage(id, imageId, user.companyId ?? null, user.id);
  }

  @Put(':id/images/:imageId/cover')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعيين صورة المعرض كصورة رئيسية للصنف' })
  setGalleryCover(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.items.setCoverFromGallery(id, imageId, user.companyId ?? null, user.id);
  }

  @Get(':id/images/:imageId')
  @Header('Cache-Control', 'private, max-age=300')
  @ApiOkResponse({ description: 'صورة من معرض الصنف' })
  async galleryImage(
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const src = await this.items.getGalleryImageSource(id, imageId, user.companyId ?? null);
    if (src.kind === 'redirect') {
      res.redirect(src.url);
      return;
    }
    res.header('Content-Type', src.mime).send(src.buffer);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'تفاصيل صنف' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.items.findOne(id, user.companyId ?? null);
  }

  @Post()
  @Permissions('item.manage')
  @ApiCreatedResponse({ description: 'إنشاء صنف' })
  create(@Body() dto: CreateItemDto, @CurrentUser() user: AuthUser) {
    return this.items.create(dto, user.companyId ?? null, user.id);
  }

  @Patch(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تحديث صنف' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto, @CurrentUser() user: AuthUser) {
    return this.items.update(id, dto, user.companyId ?? null, user.id);
  }

  @Delete(':id')
  @Permissions('item.manage')
  @ApiOkResponse({ description: 'تعطيل صنف (إيقاف)' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    await this.items.update(id, { active: false }, user.companyId ?? null, user.id);
    return { ok: true };
  }
}