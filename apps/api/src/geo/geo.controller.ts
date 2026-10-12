import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Features, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { EndShiftDto, LocationDto, QueryGeoDto, StartShiftDto, VisitDto } from './geo.dto.js';
import { GeoService } from './geo.service.js';

@ApiTags('geo')
@ApiBearerAuth()
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Post('shifts/start')
  @Permissions('geo.report')
  @ApiOkResponse({ description: 'بدء وردية المندوب (يعيد الوردية النشطة إن وجدت)' })
  startShift(@CurrentUser() user: AuthUser, @Body() dto: StartShiftDto) {
    return this.geo.startShift(user.sub, dto, user.companyId ?? null);
  }

  @Post('shifts/end')
  @Permissions('geo.report')
  @ApiOkResponse({ description: 'إنهاء الوردية' })
  endShift(@CurrentUser() user: AuthUser, @Body() dto: EndShiftDto) {
    return this.geo.endShift(user.sub, dto, user.companyId ?? null);
  }

  @Get('shifts/current')
  @Permissions('geo.report')
  @ApiOkResponse({ description: 'الوردية النشطة للمندوب الحالي' })
  currentShift(@CurrentUser() user: AuthUser) {
    return this.geo.currentShift(user.sub, user.companyId ?? null);
  }

  @Post('locations')
  @Permissions('geo.report')
  @ApiOkResponse({ description: 'إرسال موقع أثناء الوردية (30-120 ثانية)' })
  pushLocation(@CurrentUser() user: AuthUser, @Body() dto: LocationDto) {
    return this.geo.pushLocation(user.sub, dto, user.companyId ?? null);
  }

  @Post('visits')
  @Permissions('geo.report')
  @ApiOkResponse({ description: 'تسجيل زيارة عميل مع مطابقة القرب (150م)' })
  recordVisit(@CurrentUser() user: AuthUser, @Body() dto: VisitDto) {
    return this.geo.recordVisit(user.sub, dto, user.companyId ?? null);
  }

  @Get('shifts')
  @Permissions('rep.track', 'geo.fleet')
  @Features('geotracking.fleet')
  @ApiOkResponse({ description: 'قائمة الورديات (لإعادة عرض المسار)' })
  shifts(@Query() query: QueryGeoDto, @CurrentUser() user: AuthUser) {
    return this.geo.shiftsList(query, user.companyId ?? null);
  }

  @Get('map')
  @Permissions('rep.track', 'geo.fleet')
  @Features('geotracking.fleet')
  @ApiOkResponse({ description: 'خريطة المناديب: آخر موقع لكل مندوب' })
  liveMap(@CurrentUser() user: AuthUser) {
    return this.geo.liveMap(user.companyId ?? null);
  }

  @Get('shifts/:id/route')
  @Permissions('rep.track')
  @ApiOkResponse({ description: 'مسار اليوم: إعادة عرض خط السير (Route Replay)' })
  route(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.geo.route(id, user.roleCode === 'SALES_REP' ? user.sub : undefined, user.companyId ?? null);
  }

  @Get('reports/summary')
  @Permissions('rep.track', 'geo.fleet')
  @Features('geotracking.fleet')
  @ApiOkResponse({ description: 'تقارير المندوبين: المسافة، زمن التوقف، العملاء غير المزارين' })
  reportSummary(@Query() query: QueryGeoDto, @CurrentUser() user: AuthUser) {
    return this.geo.reportSummary(query, user.companyId ?? null);
  }
}