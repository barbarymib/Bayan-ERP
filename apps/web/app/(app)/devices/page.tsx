'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  type DeviceRegistration,
  type DevicesPage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, ErrorBox, PageHeader, Select, Td, Th, formatDate } from '@/components/ui';

export default function DevicesPage() {
  const { user } = useAuth();
  const allowed = can(user, 'device.manage');

  const [data, setData] = useState<DevicesPage | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    get<DevicesPage>('/devices')
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load devices');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, refresh]);

  async function toggle(device: DeviceRegistration) {
    const verb = device.active ? 'revoke' : 'activate';
    if (
      device.active &&
      !window.confirm(`Revoke device "${device.deviceId}"? Sync will stop immediately.`)
    ) {
      return;
    }
    setBusy(device.id);
    setError(null);
    try {
      await post(`/devices/${device.id}/${verb}`, {});
      setRefresh((r) => r + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${verb} device`);
    } finally {
      setBusy(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Devices & Security" />
        <ErrorBox message="You do not have permission to manage devices" />
      </div>
    );
  }

  const devices = (data?.devices ?? []).filter((d) =>
    status === '' ? true : status === 'active' ? d.active : !d.active,
  );

  return (
    <div>
      <PageHeader
        title="Devices & Security"
        action={
          <Button variant="secondary" onClick={() => setRefresh((r) => r + 1)}>
            Refresh
          </Button>
        }
      />
      <div className="mb-4 flex items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="w-48">
          <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </Select>
        </div>
        <div className="pb-2 text-sm text-gray-500">
          {data ? `${devices.length} of ${data.total} devices` : null}
        </div>
      </div>
      {error ? <ErrorBox message={error} onRetry={() => setRefresh((r) => r + 1)} /> : null}
      <div className="rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-xs uppercase text-gray-400">
              <Th>User</Th>
              <Th>Device</Th>
              <Th>Device ID</Th>
              <Th>Status</Th>
              <Th>Last Seen</Th>
              <Th>Registered</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={7}>Loading...</Td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <Td colSpan={7}>No devices</Td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 text-right">
                  <Td className="font-semibold">
                    <div>{d.user?.name ?? '-'}</div>
                    <div className="text-xs text-gray-400">
                      {d.user?.repCode ?? ''} {d.user?.role?.code ?? ''}
                    </div>
                  </Td>
                  <Td>{d.deviceName ?? '-'}</Td>
                  <Td>
                    <span className="font-mono text-xs">{d.deviceId}</span>
                  </Td>
                  <Td>
                    <Badge color={d.active ? 'green' : 'red'}>{d.active ? 'Active' : 'Revoked'}</Badge>
                  </Td>
                  <Td>{d.lastSeenAt ? formatDate(d.lastSeenAt) : 'Never'}</Td>
                  <Td>{formatDate(d.createdAt)}</Td>
                  <Td>
                    <Button
                      variant={d.active ? 'danger' : 'secondary'}
                      disabled={busy === d.id}
                      onClick={() => toggle(d)}
                    >
                      {d.active ? 'Revoke' : 'Activate'}
                    </Button>
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
