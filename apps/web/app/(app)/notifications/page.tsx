'use client';

import { useEffect, useState } from 'react';
import { can, get, post, type NotificationsPage, type NotificationDoc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBox,
  Notice,
  PageHeader,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  formatDate,
} from '@/components/ui';
import { IconCheck, IconNotification, IconRefresh } from '@/components/icons';

const TYPE_LABEL: Record<string, string> = {
  discount_approval: 'موافقة على خصم',
  return_approval: 'موافقة على مرتجع',
  low_stock: 'تنبيه نقص مخزون',
  credit_limit: 'تجاوز حد ائتماني',
  sync_failed: 'فشل مزامنة جهاز',
  archive_reminder: 'تذكير أرشفة دورية',
  backup_reminder: 'تذكير نسخ احتياطي',
};

const TYPE_COLOR: Record<string, string> = {
  discount_approval: 'amber',
  return_approval: 'amber',
  low_stock: 'red',
  credit_limit: 'red',
  sync_failed: 'red',
  archive_reminder: 'blue',
  backup_reminder: 'purple',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const allowed = can(user, 'notification.view');

  const [page, setPage] = useState<NotificationsPage | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    get<NotificationsPage>(`/notifications?limit=100${unreadOnly ? '&unreadOnly=true' : ''}`)
      .then((data) => {
        if (!cancelled) {
          setPage(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الإشعارات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, unreadOnly, refresh]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader title="مركز الإشعارات والتنبيهات" />
        <ErrorBox message="ليس لديك صلاحية لعرض سجل الإشعارات" />
      </div>
    );
  }

  const markRead = async (n: NotificationDoc) => {
    try {
      await post(`/notifications/${n.id}/read`, {});
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تعليم الإشعار كمقروء');
    }
  };

  const markAllRead = async () => {
    try {
      await post('/notifications/read-all', {});
      setNotice('تم تعليم جميع الإشعارات كمقروءة بنجاح');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تعليم الإشعارات كمقروءة');
    }
  };

  const refreshAlerts = async () => {
    try {
      await post('/notifications/refresh', {});
      setNotice('تم فحص وتحديث التنبيهات الآلية بنجاح');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحديث التنبيهات');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز الإشعارات والتنبيهات"
        description="متابعة تنبيهات المخزون، تجاوز الائتمان، وموافقات الخصومات والمرتجعات"
        badge={
          page ? (
            <Badge color={page.unread > 0 ? 'amber' : 'gray'} dot={page.unread > 0}>
              {page.unread} غير مقروء
            </Badge>
          ) : null
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setUnreadOnly(false)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  !unreadOnly ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setUnreadOnly(true)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  unreadOnly ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                غير المقروء فقط
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refreshAlerts}
              icon={<IconRefresh size={14} />}
            >
              فحص التنبيهات
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllRead}
              icon={<IconCheck size={14} />}
            >
              تحديد الكل كمقروء
            </Button>
          </div>
        }
      />

      {notice ? <Notice type="success">{notice}</Notice> : null}
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((r) => r + 1)} /> : null}

      <Table>
        <Thead>
          <tr>
            <Th>النوع</Th>
            <Th>عنوان التنبيه</Th>
            <Th>تفاصيل التنبيه</Th>
            <Th>التاريخ</Th>
            <Th>الحالة</Th>
            <Th>الإجراء</Th>
          </tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr>
              <Td colSpan={6} className="py-12 text-center text-xs font-bold text-slate-400">
                جارِ تحميل التنبيهات…
              </Td>
            </Tr>
          ) : !page || page.items.length === 0 ? (
            <Tr>
              <Td colSpan={6}>
                <EmptyState
                  title="لا توجد إشعارات حالياً"
                  description="النظام سليم ومحدث — ستظهر هنا تنبيهات المخزون والموافقات عند حدوثها"
                  icon={<IconNotification size={22} />}
                />
              </Td>
            </Tr>
          ) : (
            page.items.map((n) => (
              <Tr key={n.id} className={!n.readAt ? 'bg-amber-50/20 font-semibold' : ''}>
                <Td>
                  <Badge color={TYPE_COLOR[n.type] ?? 'gray'}>
                    {TYPE_LABEL[n.type] ?? n.type}
                  </Badge>
                </Td>
                <Td className="font-bold text-slate-900">{n.title}</Td>
                <Td className="text-slate-500 max-w-md">{n.body ?? '—'}</Td>
                <Td className="text-xs text-slate-400">{formatDate(n.createdAt)}</Td>
                <Td>
                  {n.readAt ? (
                    <Badge color="gray">مقروء</Badge>
                  ) : (
                    <Badge color="amber" dot>
                      جديد
                    </Badge>
                  )}
                </Td>
                <Td>
                  {!n.readAt ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => markRead(n)}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      تعليم كمقروء
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </div>
  );
}
