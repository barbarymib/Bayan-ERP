import { Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions, type AuthUser } from '../auth/auth.decorators.js';
import { QueryNotificationsDto } from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Permissions('notification.view')
  @ApiOkResponse({ description: 'قائمة الإشعارات الخاصة بالمستخدم' })
  list(@Query() query: QueryNotificationsDto, @CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  @Permissions('notification.view')
  @ApiOkResponse({ description: 'عدد الإشعارات غير المقروءة' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('refresh')
  @Permissions('notification.view')
  @ApiOkResponse({ description: 'فحص التنبيهات الآلية وإنشاء الإشعارات المجمعة (§5.15)' })
  refresh() {
    return this.notifications.refreshAlerts();
  }

  @Post(':id/read')
  @Permissions('notification.view')
  @ApiOkResponse({ description: 'تحديد إشعار كمقروء' })
  markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @Permissions('notification.view')
  @ApiOkResponse({ description: 'تحديد كل الإشعارات كمقروءة' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}