'use client';

import { useEffect, useState } from 'react';
import { can, get, patch, type CompanySettings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorBox, Field, Notice, PageHeader, TextInput } from '@/components/ui';

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const manage = can(user, 'company.manage');

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [taxPercent, setTaxPercent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<CompanySettings>('/company')
      .then((d) => {
        if (!cancelled) {
          setSettings(d);
          setTaxPercent(String(d.company.taxPercent));
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل إعدادات الشركة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const d = await patch<{ company: { taxPercent: number } }>('/company', { taxPercent: Number(taxPercent) || 0 });
      setSettings((s) => (s ? { ...s, company: { ...s.company, taxPercent: d.company.taxPercent } } : s));
      setTaxPercent(String(d.company.taxPercent));
      setNotice('تم حفظ إعدادات الشركة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإعدادات');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="إعدادات الشركة" />

      {notice ? (
        <div className="mb-3">
          <Notice type="success">{notice}</Notice>
        </div>
      ) : null}

      {loading ? (
        <div className="text-gray-400">جارِ التحميل…</div>
      ) : !settings ? (
        <ErrorBox message={error ?? 'تعذر تحميل الإعدادات'} onRetry={() => setRefresh((s) => s + 1)} />
      ) : (
        <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Field label="اسم الشركة">
              <TextInput value={settings.company.nameAr} readOnly disabled />
            </Field>
            <Field label="كود الشركة">
              <TextInput value={settings.company.code} readOnly disabled dir="ltr" />
            </Field>
          </div>

          <Field label="الضريبة الافتراضية % (بيانات الأسعار)">
            <TextInput
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              type="number"
              min="0"
              max="100"
              dir="ltr"
              disabled={!manage}
            />
          </Field>

          <div className="mt-3 text-xs text-gray-400">
            تُستخدم هذه الضريبة افتراضيًا عند إنشاء بيان أسعار جديد، ويمكن تجاوزها لكل بيان على حدة.
          </div>

          {!manage ? (
            <div className="mt-2 text-xs text-amber-600">لديك صلاحية العرض فقط (company.manage).</div>
          ) : null}

          {error ? (
            <div className="mt-3">
              <ErrorBox message={error} />
            </div>
          ) : null}

          {manage ? (
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={busy}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
