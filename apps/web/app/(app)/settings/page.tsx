'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { can, del, get, patch, put, type CompanyFeatureItem, type CompanyFeaturesResponse, type CompanySettings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CURRENCIES, setActiveCurrency } from '@/lib/currency';
import { fileToDataUrl } from '@/lib/image';
import {
  COLOR_PRESETS,
  RADIUS_PRESETS,
  STYLE_PRESETS,
  useTheme,
  type ColorPreset,
  type RadiusPreset,
  type ThemeStyle,
} from '@/lib/theme';
import { BayanMark, MiBLogo } from '@/components/brand';
import {
  IconCheck,
  IconPalette,
  IconRefresh,
  IconSparkles,
} from '@/components/icons';
import { Badge, Button, ErrorBox, Field, Notice, PageHeader, Select, TextInput } from '@/components/ui';

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const manage = can(user, 'company.manage');
  const [activeTab, setActiveTab] = useState<'company' | 'theme'>('company');

  // Theme Hook
  const {
    style: themeStyle,
    color: themeColor,
    radius: themeRadius,
    colorDef,
    styleDef,
    setStyle,
    setColor,
    setRadius,
    resetTheme,
  } = useTheme();

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
      <PageHeader
        title={activeTab === 'company' ? 'إعدادات الشركة' : 'تخصيص المظهر والسمات والألوان'}
        description={
          activeTab === 'company'
            ? 'البيانات التجارية، الضريبة، العملة والشعار الرسمي'
            : 'اختر نمط الواجهة وباليتة الألوان المفضلة لديك لتطبيقها فورياً على كامل النظام'
        }
      />

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-4 select-none overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'company'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          إعدادات الشركة
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'theme'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <IconPalette size={16} />
          <span>المظهر والسمات والألوان</span>
          <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-2xs"
            style={{ backgroundColor: colorDef.primary }}
          />
        </button>

        <Link
          href="/settings/diagnostics"
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          تشخيص وسلامة النظام
        </Link>
      </div>

      {activeTab === 'theme' ? (
        /* Appearance & Theme Customizer Tab */
        <div className="max-w-3xl space-y-6">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs font-semibold text-blue-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconSparkles size={18} className="text-blue-600 shrink-0" />
              <span>
                يتم حفظ جميع التعديلات تلقائياً في جهازك وتطبيقها فوراً عبر كافة صفحات وشاشات النظام.
              </span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={resetTheme}
              icon={<IconRefresh size={13} />}
              className="text-blue-700 hover:bg-blue-100 shrink-0"
            >
              استعادة الافتراضي
            </Button>
          </div>

          {/* Section 1: Preset Styles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                1. أنماط الواجهة الجاهزة (Preset Styles)
              </label>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                النمط النشط: {styleDef.name.split('(')[0].trim()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(STYLE_PRESETS) as ThemeStyle[]).map((key) => {
                const item = STYLE_PRESETS[key];
                const isActive = themeStyle === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStyle(key)}
                    className={`flex flex-col items-start p-4 rounded-xl border-2 text-start transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/15 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-900">{item.name}</span>
                      {isActive ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
                          <IconCheck size={12} />
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Preset Colors */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                2. باليتات الألوان والسمات (Preset Colors)
              </label>
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
                style={{
                  backgroundColor: colorDef.bgLight,
                  color: colorDef.hover,
                  borderColor: colorDef.ring,
                }}
              >
                اللون الحالي: {colorDef.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((key) => {
                const item = COLOR_PRESETS[key];
                const isActive = themeColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-start cursor-pointer transition-all ${
                      isActive
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/15 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-inner ring-2 ring-white"
                      style={{ backgroundColor: item.primary }}
                    >
                      {isActive ? <IconCheck size={14} className="text-white drop-shadow-xs" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{item.nameEn}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Corner Radius */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <label className="block mb-3 text-xs font-black uppercase tracking-wider text-slate-700">
              3. انحناء الحواف والإطارات (Corner Radius)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(RADIUS_PRESETS) as RadiusPreset[]).map((key) => {
                const item = RADIUS_PRESETS[key];
                const isActive = themeRadius === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRadius(key)}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 border text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{item.name}</span>
                    {isActive ? <IconCheck size={14} className="text-blue-600" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Live Interactive Preview */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <IconSparkles size={15} className="text-blue-600" />
                <span>معاينة حية فورية لعناصر النظام (Live Preview)</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                مفعّل ونشط
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-2xs border border-slate-200">
              <Button variant="primary" size="sm" icon={<IconPalette size={14} />}>
                زر أساسي باللون المحدد
              </Button>

              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full"
                style={{
                  backgroundColor: colorDef.bgLight,
                  color: colorDef.badgeText,
                  borderColor: colorDef.ring,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorDef.primary }} />
                <span>شارة حالة ملونة</span>
              </span>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span
                  className="h-2.5 w-2.5 rounded-full shadow-xs animate-pulse"
                  style={{ backgroundColor: colorDef.primary }}
                />
                <span>مؤشر حالة حي</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Company Settings Tab */
        <>

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
      </>
      )}

      {/* System Platform & Provider Card */}
      <div className="mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BayanMark size={36} />
            <div>
              <div className="text-sm font-bold text-slate-900">نظام بيان ERP</div>
              <div className="text-xs text-slate-500">منظومة رقمية متكاملة لمبيعات وإدارة الحدايد والبويات</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-100 self-start sm:self-auto">
            <span className="text-[10px] text-slate-400 font-semibold">بواسطة</span>
            <MiBLogo height={24} variant="horizontal" theme="light" />
          </div>
        </div>
      </div>
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
