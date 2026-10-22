'use client';

import { useEffect, useState } from 'react';
import {
  can,
  get,
  post,
  type BackupDoc,
  type BackupDrillResult,
  type BackupsPage,
  type BackupVerifyResult,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  ErrorBox,
  Notice,
  PageHeader,
  Td,
  Th,
} from '@/components/ui';

const STATUS_LABEL: Record<string, string> = {
  RUNNING: 'جارٍ',
  DONE: 'مكتمل',
  FAILED: 'فشل',
};

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'blue',
  DONE: 'green',
  FAILED: 'red',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export default function BackupsPage() {
  const { user } = useAuth();
  const canRun = can(user, 'archive.run');

  const [rows, setRows] = useState<BackupDoc[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [drillingId, setDrillingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<BackupsPage>('/backups')
      .then((data) => {
        if (!cancelled) setRows(data.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل النسخ الاحتياطية');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function runNow() {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const created = await post<BackupDoc>('/backups', {});
      setNotice(
        `تم إنشاء النسخة ${created.code} (${formatBytes(created.sizeBytes)}) وتم تشفيرها AES-256-GCM`,
      );
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تشغيل النسخة الاحتياطية');
    } finally {
      setRunning(false);
    }
  }

  async function verify(id: number) {
    setVerifyingId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await post<BackupVerifyResult>(`/backups/${id}/verify`, {});
      if (res.ok) {
        setNotice(`النسخة سليمة: تحقق من الـ SHA-256 وتم فك التشفير (${formatBytes(res.decryptedBytes ?? 0)})`);
      } else {
        setError(res.error ?? 'فشلت مراجعة النسخة');
      }
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشلت المراجعة');
    } finally {
      setVerifyingId(null);
    }
  }

  async function runDrill(id: number) {
    setDrillingId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await post<BackupDrillResult>(`/backups/${id}/restore-drill`, {});
      if (res.ok) {
        setNotice(
          `تم اختبار الاسترجاع بنجاح للنسخة ${res.code}: تم استعادة وتأكيد ${res.tables ?? 0} جدول و ${res.companies ?? 0} شركات في بيئة اختبار معزولة`,
        );
      } else {
        setError(res.detail ?? 'فشل اختبار الاسترجاع');
      }
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تنفيذ اختبار الاسترجاع');
    } finally {
      setDrillingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="النسخ الاحتياطي المشفر"
        action={
          canRun ? (
            <Button onClick={() => void runNow()} disabled={running}>
              {running ? 'جارِ التشغيل…' : 'تشغيل نسخة الآن'}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        تُحفظ النسخ بـ <span className="font-semibold">AES-256-GCM</span> وتختم بـ SHA-256.
        تُشغَّل نسخة يومية تلقائياً (أوّل الوقت المحدد في{' '}
        <span className="font-mono">BACKUP_DAILY_TIME</span>، الافتراضي 02:00). استخدم «مراجعة»
        للتحقق من إمكانية فك التشفير فعلياً (اختبار الاسترجاع).
      </div>

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}
      {error ? <div className="mb-3"><ErrorBox message={error} /></div> : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-max border-collapse">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th>الكود</Th>
              <Th>الملف</Th>
              <Th>الحجم</Th>
              <Th>الحالة</Th>
              <Th>التشفير</Th>
              <Th>SHA-256</Th>
              <Th>فحص الاسترجاع</Th>
              <Th>التاريخ</Th>
              <Th>بواسطة</Th>
              <Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={10}>
                  جارِ التحميل…
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td className="py-6 text-center text-gray-400" colSpan={10}>
                  لا توجد نسخ احتياطية بعد
                </Td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td className="font-mono font-semibold">{b.code}</Td>
                  <Td className="font-mono text-xs" dir="ltr">
                    {b.filename}
                  </Td>
                  <Td>{formatBytes(b.sizeBytes)}</Td>
                  <Td>
                    <Badge color={STATUS_COLOR[b.status] ?? 'gray'}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                    {b.error ? (
                      <div className="mt-1 max-w-[16rem] text-xs text-red-600">{b.error}</div>
                    ) : null}
                  </Td>
                  <Td>{b.encrypted ? <Badge color="green">مشفّر</Badge> : <Badge color="gray">—</Badge>}</Td>
                  <Td className="max-w-[10rem] truncate font-mono text-xs" dir="ltr" title={b.sha256}>
                    {b.sha256}
                  </Td>
                  <Td>
                    {b.lastDrillAt ? (
                      <div>
                        <Badge color={b.lastDrillOk ? 'green' : 'red'}>
                          {b.lastDrillOk ? 'سليم ومجرّب' : 'فشل التجربة'}
                        </Badge>
                        <div className="mt-1 font-mono text-[10px] text-gray-500" dir="ltr" title={b.lastDrillDetail ?? undefined}>
                          {new Date(b.lastDrillAt).toLocaleDateString('ar-EG')}
                        </div>
                      </div>
                    ) : (
                      <Badge color="gray">لم يُختبر</Badge>
                    )}
                  </Td>
                  <Td>{new Date(b.createdAt).toLocaleString('ar-EG')}</Td>
                  <Td>{b.createdBy?.name ?? '—'}</Td>
                  <Td>
                    {canRun ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          disabled={verifyingId === b.id || drillingId === b.id || b.status !== 'DONE'}
                          onClick={() => void verify(b.id)}
                        >
                          {verifyingId === b.id ? 'جارٍ…' : 'مراجعة'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={drillingId === b.id || verifyingId === b.id || b.status !== 'DONE'}
                          onClick={() => void runDrill(b.id)}
                        >
                          {drillingId === b.id ? 'جارٍ…' : 'تمرين استرجاع'}
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
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
