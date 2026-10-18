'use client';

import { useEffect, useState } from 'react';
import { can, del, get, patch, put, type CompanyFeatureItem, type CompanyFeaturesResponse, type CompanySettings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, ErrorBox, Field, Notice, PageHeader, TextInput } from '@/components/ui';

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

      <FeaturesSection />
    </div>
  );
}

function FeaturesSection() {
  const { user } = useAuth();
  const manage = can(user, 'company.manage');
  const [features, setFeatures] = useState<CompanyFeatureItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<CompanyFeaturesResponse>('/company/features')
      .then((d) => {
        if (!cancelled) {
          setFeatures(d.features);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل الميزات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function setFeature(code: string, enabled: boolean) {
    setBusyCode(code);
    setError(null);
    try {
      await put(`/company/features/${code}`, { enabled });
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تعديل الميزة');
    } finally {
      setBusyCode(null);
    }
  }

  async function resetFeature(code: string) {
    setBusyCode(code);
    setError(null);
    try {
      await del(`/company/features/${code}`);
      setRefresh((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين الميزة');
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="mt-6 max-w-xl rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-1 font-bold text-gray-700">ميزات الشركة</div>
      <div className="mb-3 text-xs text-gray-400">
        تفعيل/تعطيل ميزة على مستوى شركتك (يستبدل الحالة العامة). الأزرار تعمل فقط لمن يملك company.manage.
      </div>

      {loading ? <div className="text-gray-400">جارِ التحميل…</div> : null}
      {error ? <ErrorBox message={error} /> : null}

      {!loading && features ? (
        <ul className="divide-y divide-gray-100">
          {features.map((f) => (
            <li key={f.code} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-semibold">{f.nameAr}</div>
                <div className="text-xs text-gray-400" dir="ltr">
                  {f.code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {f.scope === 'COMPANY' ? (
                  <Badge color="blue">شركة</Badge>
                ) : (
                  <Badge color="gray">عام</Badge>
                )}
                {manage ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setFeature(f.code, !f.enabled)}
                      disabled={busyCode === f.code}
                    >
                      {f.enabled ? 'تعطيل' : 'تفعيل'}
                    </Button>
                    {f.scope === 'COMPANY' ? (
                      <Button variant="ghost" onClick={() => resetFeature(f.code)} disabled={busyCode === f.code}>
                        إعادة تعيين
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Badge color={f.enabled ? 'green' : 'red'}>{f.enabled ? 'مفعّلة' : 'معطّلة'}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!manage && !loading ? (
        <div className="mt-2 text-xs text-amber-600">لديك صلاحية العرض فقط (company.manage).</div>
      ) : null}
    </div>
  );
}
