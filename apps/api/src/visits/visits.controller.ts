import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { CreateVisitPlanDto, QueryVisitPlansDto, UpdateVisitPlanLineDto } from './visits.dto.js';
import { VisitsService } from './visits.service.js';

@ApiTags('visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('plans')
  @Permissions('visit.plan.manage')
  @ApiOkResponse({ description: 'إنشاء/تحديث خطة زيارات يومية' })
  create(@Body() dto: CreateVisitPlanDto, @CurrentUser() user: AuthUser) {
    return this.visits.create(dto, user);
  }

  @Get('plans')
  @Permissions('visit.plan.view')
  @ApiOkResponse({ description: 'قائمة خطط الزيارات' })
  list(@Query() query: QueryVisitPlansDto, @CurrentUser() user: AuthUser) {
    return this.visits.list(query, user.companyId ?? null);
  }

  @Get('plans/today')
  @Permissions('visit.plan.view')
  @ApiOkResponse({ description: 'خطة اليوم للمندوب الحالي' })
  today(@CurrentUser() user: AuthUser) {
    return this.visits.today(user);
  }

  @Get('plans/:id')
  @Permissions('visit.plan.view')
  @ApiOkResponse({ description: 'تفاصيل خطة زيارات' })
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.visits.get(id, user.companyId ?? null);
  }

  @Post('plans/:id/lines/:lineId/status')
  @Permissions('visit.plan.view')
  @ApiOkResponse({ description: 'تحديث حالة بند زيارة (PLANNED/DONE/MISSED)' })
  setLineStatus(
    @Param('id', ParseIntPipe) id: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: UpdateVisitPlanLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.visits.setLineStatus(id, lineId, dto, user);
  }
}