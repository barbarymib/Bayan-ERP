import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import {
  AbortStocktakeDto,
  ApproveStocktakeDto,
  OpenStocktakeDto,
  QueryStocktakesDto,
  StocktakeCountsDto,
} from './stocktakes.dto.js';
import { StocktakesService } from './stocktakes.service.js';

@ApiTags('stocktakes')
@ApiBearerAuth()
@Controller('stocktakes')
export class StocktakesController {
  constructor(private readonly stocktakes: StocktakesService) {}

  @Post()
  @Permissions('stocktake.execute')
  @ApiOkResponse({ description: 'فتح جلسة جرد لمخزن وتجميد رصيد النظام (Snapshot)' })
  open(@Body() dto: OpenStocktakeDto, @CurrentUser() user: AuthUser) {
    return this.stocktakes.open(dto, user);
  }

  @Get()
  @Permissions('stocktake.view')
  @ApiOkResponse({ description: 'قائمة جلسات الجرد مع الملخصات' })
  list(@Query() query: QueryStocktakesDto, @CurrentUser() user: AuthUser) {
    return this.stocktakes.list(query, user.companyId ?? null);
  }

  @Get(':id')
  @Permissions('stocktake.view')
  @ApiOkResponse({ description: 'تفاصيل جلسة جرد بخطوطها وملخصها' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.stocktakes.get(id, user.companyId ?? null);
  }

  @Put(':id/counts')
  @Permissions('stocktake.execute')
  @ApiOkResponse({ description: 'إدخال الكميات الفعلية (عدة جولات)' })
  counts(@Param('id', ParseIntPipe) id: number, @Body() dto: StocktakeCountsDto, @CurrentUser() user: AuthUser) {
    return this.stocktakes.counts(id, dto, user);
  }

  @Post(':id/review')
  @Permissions('stocktake.execute')
  @ApiOkResponse({ description: 'الانتقال لمرحلة المراجعة' })
  review(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.stocktakes.review(id, user);
  }

  @Post(':id/back-to-counting')
  @Permissions('stocktake.execute')
  @ApiOkResponse({ description: 'العودة للعد للمراجعة (إعادة عد)' })
  backToCounting(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.stocktakes.backToCounting(id, user);
  }

  @Post(':id/approve')
  @Permissions('stocktake.approve')
  @ApiOkResponse({ description: 'اعتماد المالك: تسوية تلقائية للفروقات ثم إغلاق الجلسة' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveStocktakeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stocktakes.approve(id, user, dto);
  }

  @Post(':id/abort')
  @Permissions('stocktake.approve')
  @ApiOkResponse({ description: 'إلغاء جلسة غير مكتملة (بدون تسوية)' })
  abort(@Param('id', ParseIntPipe) id: number, @Body() dto: AbortStocktakeDto, @CurrentUser() user: AuthUser) {
    return this.stocktakes.abort(id, dto, user);
  }
}