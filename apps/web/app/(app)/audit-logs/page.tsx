'use client';

import { Fragment, useEffect, useState } from 'react';
import { can, get, qs, type AuditLogDoc, type AuditLogsPage, type User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  ErrorBox,
  Field,
  PageHeader,
  Select,
  Td,
  TextInput,
  Th,
  formatDate,
} from '@/components/ui';

const ACTION_COLOR: Record<string, string> = {
  'price.change': 'blue',
  'approval.decide': 'orange',
  create: 'green',
  update: 'blue',
  delete: 'red',
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const allowed = can(user, 'audit.view');

  const [page, setPage] = useState<AuditLogsPage | null>(null);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!allowed) return;
    get<{ users: User[] }>('/users?limit=200')
      .then((d) => setUsers(d.users))
      .catch(() => undefined);
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    get<AuditLogsPage>(`/audit-logs${qs({ entity, action, userId, from, to, limit: 100 })}`)
      .then((data) => {
        if (!cancelled) {
          setPage(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, entity, action, userId, from, to, refresh]);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Audit Log" />
        <ErrorBox message="You do not have permission to view the audit log" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" />
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-5">
        <Field label="Entity">
          <TextInput value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="price_statement" />
        </Field>
        <Field label="Action">
          <TextInput value={action} onChange={(e) => setAction(e.target.value)} placeholder="price.change" />
        </Field>
        <Field label="User">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((r) => r + 1)} /> : null}
      {page ? <div className="mb-2 text-sm text-gray-500">{page.total} entries</div> : null}
      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-xs uppercase text-gray-400">
              <Th>Date</Th>
              <Th>User</Th>
              <Th>Entity</Th>
              <Th>Action</Th>
              <Th>Entity ID</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={6}>Loading...</Td>
              </tr>
            ) : !page || page.items.length === 0 ? (
              <tr>
                <Td colSpan={6}>No audit entries</Td>
              </tr>
            ) : (
              page.items.map((log: AuditLogDoc) => (
                <Fragment key={log.id}>
                  <tr className="border-b border-gray-100 text-right">
                    <Td>{formatDate(log.at)}</Td>
                    <Td className="font-semibold">{log.user?.name ?? '-'}</Td>
                    <Td>{log.entity}</Td>
                    <Td>
                      <Badge color={ACTION_COLOR[log.action] ?? 'gray'}>{log.action}</Badge>
                    </Td>
                    <Td>{log.entityId}</Td>
                    <Td>
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        {expanded === log.id ? 'Hide' : 'View'}
                      </button>
                    </Td>
                  </tr>
                  {expanded === log.id ? (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <Td colSpan={6}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-xs font-bold uppercase text-gray-400">Before</div>
                            <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                              {log.beforeJson ? JSON.stringify(log.beforeJson, null, 2) : '-'}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-bold uppercase text-gray-400">After</div>
                            <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                              {log.afterJson ? JSON.stringify(log.afterJson, null, 2) : '-'}
                            </pre>
                          </div>
                        </div>
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
