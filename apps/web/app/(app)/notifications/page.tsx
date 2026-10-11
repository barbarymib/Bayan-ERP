'use client';

import { useEffect, useState } from 'react';
import { can, get, post, type NotificationsPage, type NotificationDoc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, ErrorBox, Notice, PageHeader, Td, Th, formatDate } from '@/components/ui';

const TYPE_LABEL: Record<string, string> = {
  discount_approval: 'Approval required',
  return_approval: 'Return approval',
  low_stock: 'Low stock',
  credit_limit: 'Credit limit',
  sync_failed: 'Sync failed',
  archive_reminder: 'Archive reminder',
  backup_reminder: 'Backup reminder',
};

const TYPE_COLOR: Record<string, string> = {
  discount_approval: 'orange',
  return_approval: 'orange',
  low_stock: 'red',
  credit_limit: 'red',
  sync_failed: 'red',
  archive_reminder: 'blue',
  backup_reminder: 'blue',
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load notifications');
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
      <div>
        <PageHeader title="Notifications" />
        <ErrorBox message="You do not have permission to view notifications" />
      </div>
    );
  }

  const markRead = async (n: NotificationDoc) => {
    try {
      await post(`/notifications/${n.id}/read`, {});
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark read');
    }
  };

  const markAllRead = async () => {
    try {
      await post('/notifications/read-all', {});
      setNotice('All notifications marked as read');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all read');
    }
  };

  const refreshAlerts = async () => {
    try {
      await post('/notifications/refresh', {});
      setNotice('Alerts refreshed');
      setRefresh((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh alerts');
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setUnreadOnly((v) => !v)}>
              {unreadOnly ? 'Show all' : 'Unread only'}
            </Button>
            <Button variant="secondary" onClick={refreshAlerts}>
              Refresh alerts
            </Button>
            <Button variant="secondary" onClick={markAllRead}>
              Mark all read
            </Button>
          </div>
        }
      />
      {notice ? <Notice type="success">{notice}</Notice> : null}
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((r) => r + 1)} /> : null}
      {page ? (
        <div className="mb-2 text-sm text-gray-500">
          {page.unread} unread / {page.total} total
        </div>
      ) : null}
      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-xs uppercase text-gray-400">
              <Th>Type</Th>
              <Th>Title</Th>
              <Th>Body</Th>
              <Th>Created</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={6}>Loading...</Td>
              </tr>
            ) : !page || page.items.length === 0 ? (
              <tr>
                <Td colSpan={6}>No notifications</Td>
              </tr>
            ) : (
              page.items.map((n) => (
                <tr key={n.id} className="border-b border-gray-100 text-right">
                  <Td>
                    <Badge color={TYPE_COLOR[n.type] ?? 'gray'}>{TYPE_LABEL[n.type] ?? n.type}</Badge>
                  </Td>
                  <Td className="font-semibold">{n.title}</Td>
                  <Td className="text-gray-500">{n.body ?? '-'}</Td>
                  <Td>{formatDate(n.createdAt)}</Td>
                  <Td>{n.readAt ? <Badge color="green">Read</Badge> : <Badge color="orange">Unread</Badge>}</Td>
                  <Td>
                    {!n.readAt ? (
                      <Button variant="secondary" onClick={() => markRead(n)}>
                        Mark read
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
