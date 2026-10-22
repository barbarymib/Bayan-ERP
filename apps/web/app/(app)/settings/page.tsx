'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { can, del, get, patch, put, type CompanyFeatureItem, type CompanyFeaturesResponse, type CompanySettings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CURRENCIES, setActiveCurrency } from '@/lib/currency';
import { fileToDataUrl } from '@/lib/image';
import { Badge, Button, ErrorBox, Field, Notice, PageHeader, Select, TextInput } from '@/components/ui';

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const manage = can(user, 'company.manage');

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
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
          setNameAr(d.company.nameAr);
          setPhone(d.company.phone ?? '');
          setEmail(d.company.email ?? '');
          setContactName(d.company.contactName ?? '');
          setTaxPercent(String(d.company.taxPercent));
          setCurrency(d.company.currency ?? 'EGP');
          setLogoUrl(d.company.logoUrl ?? null);
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
      const d = await patch<{ company: CompanySettings['company'] }>('/company', {
        nameAr,
        phone,
        email,
        contactName,
        taxPercent: Number(taxPercent) || 0,
        currency,
        // R4-C4: أرسل الشعار فقط عند تغيّره (data URL كبير لا يُعاد كل حفظ).
        ...(logoUrl !== (settings?.company.logoUrl ?? null) ? { logoUrl: logoUrl ?? '' } : {}),
      });
      setSettings((s) => (s ? { ...s, company: d.company } : s));
      setTaxPercent(String(d.company.taxPercent));
      setCurrency(d.company.currency ?? 'EGP');
      setLogoUrl(d.company.logoUrl ?? null);
      setActiveCurrency(d.company.currency);
      setNotice('تم حفظ إعدادات الشركة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإعدادات');
    } finally {
      setBusy(false);
    }
  }

  async function pickLogo(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      setLogoUrl(await fileToDataUrl(file, 512, 0.85));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر قراءة الصورة');
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="إعدادات الشركة" />

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-4">
        <Link
          href="/settings"
          className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors"
        >
          إعدادات الشركة
        </Link>
        <Link
          href="/settings/diagnostics"
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          تشخيص وسلامة النظام
        </Link>
      </div>

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
              <TextInput value={nameAr} onChange={(e) => setNameAr(e.target.value)} disabled={!manage} />
            </Field>
            <Field label="كود الشركة">
              <TextInput value={settings.company.code} readOnly disabled dir="ltr" />
            </Field>
            <Field label="الهاتف">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" disabled={!manage} />
            </Field>
            <Field label="البريد الإلكتروني">
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" disabled={!manage} />
            </Field>
            <Field label="الشخص المسؤول">
              <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={!manage} />
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

          <div className="mt-3">
            <Field label="عملة الشركة">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!manage} dir="ltr">
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.nameAr}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-2 text-xs text-gray-400">
              تُستخدم في تفقيط المبالغ بالعربية وفي أوراق الطباعة والتصدير. الافتراضي: جنيه مصري.
            </div>
          </div>

          {/* R4-C4: شعار يظهر في ترويسة الطباعة وPDF (§5.6). */}
          <div className="mt-4">
            <Field label="شعار الشركة (للوصول والطباعة)">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="شعار الشركة"
                    className="h-14 w-14 rounded border border-gray-200 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                    بلا شعار
                  </div>
                )}
                {manage ? (
                  <>
                    <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      {logoBusy ? 'جارٍ المعالجة…' : logoUrl ? 'تغيير' : 'رفع صورة'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={logoBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = '';
                          void pickLogo(f);
                        }}
                      />
                    </label>
                    {logoUrl ? (
                      <Button variant="ghost" onClick={() => setLogoUrl(null)}>
                        إزالة
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Field>
            <div className="mt-1 text-xs text-gray-400">يظهر في ترويسة طباعة بيان الأسعار وملف PDF — يُضغط تلقائياً إلى 512 بكسل.</div>
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
