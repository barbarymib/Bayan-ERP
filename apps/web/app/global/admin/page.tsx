'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BayanMark, MiBLogo } from '@/components/brand';
import { Badge, Button, ErrorBox, Notice } from '@/components/ui';
import { globalApi, getGlobalToken } from '@/lib/global';
import type { SystemSettingRow } from '@/lib/api';

const inputCls = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';

interface CompanyRow {
  id: number;
  code: string;
  nameAr: string;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  status: 'ACTIVE' | 'DISABLED';
  usersCount: number;
}

interface FeatureRow {
  id: number;
  code: string;
  nameAr: string;
  enabled: boolean;
  userOverrides: number;
  companyOverrides: number;
}

interface CompanyFeatureView {
  id: number;
  code: string;
  nameAr: string;
  globalEnabled: boolean;
  companyOverride: boolean | null;
}

interface FeatureUser {
  id: number;
  name: string;
  repCode: string | null;
  company: { id: number; nameAr: string; status: string } | null;
  roleCode: string;
  override: boolean | null;
}

interface ReportCompany {
  id: number;
  code: string;
  nameAr: string;
  status: 'ACTIVE' | 'DISABLED';
  users: number;
  items: number;
  customers: number;
  statements: number;
  netSales: number;
  lastStatementAt: string | null;
}

interface AdminReport {
  totals: {
    companies: number;
    activeCompanies: number;
    disabledCompanies: number;
    users: number;
    items: number;
    customers: number;
    statements: number;
    netSales: number;
  };
  companies: ReportCompany[];
}

const fmtNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

function TriSwitch({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const map = {
    auto: { label: 'تلقائي', cls: 'bg-gray-100 text-gray-600' },
    on: { label: 'مفعّلة', cls: 'bg-green-100 text-green-700' },
    off: { label: 'معطّلة', cls: 'bg-red-100 text-red-700' },
  } as const;
  const key = value === null ? 'auto' : value ? 'on' : 'off';
  const current = map[key];
  return (
    <select
      value={key}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === 'auto' ? null : v === 'on');
      }}
      className={`rounded-lg px-2 py-1 text-xs font-semibold ${current.cls}`}
    >
      <option value="auto">تلقائي</option>
      <option value="on">مفعّلة</option>
      <option value="off">معطّلة</option>
    </select>
  );
}

function SettingRow({
  setting,
  busy,
  onSave,
  onRemove,
}: {
  setting: SystemSettingRow;
  busy: boolean;
  onSave: (v: string) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(setting.value);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-semibold text-gray-900">{setting.key}</div>
        <div className="text-xs text-gray-400">آخر تحديث: {new Date(setting.updatedAt).toLocaleString('ar-EG')}</div>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-56 rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <Button variant="secondary" disabled={busy || value === setting.value} onClick={() => onSave(value)}>
        حفظ
      </Button>
      <Button variant="danger" disabled={busy} onClick={onRemove}>
        حذف
      </Button>
    </div>
  );
}

export default function GlobalAdminPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [settings, setSettings] = useState<SystemSettingRow[]>([]);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [tab, setTab] = useState<'companies' | 'features' | 'settings' | 'reports'>('companies');
  const [companyFeatures, setCompanyFeatures] = useState<Record<number, CompanyFeatureView[]>>({});
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const [featureUsers, setFeatureUsers] = useState<Record<string, FeatureUser[]>>({});
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!getGlobalToken()) {
      router.replace('/global/login');
      return;
    }
    globalApi<{ companies: CompanyRow[] }>('/admin/companies')
      .then((d) => setCompanies(d.companies))
      .catch(() => undefined);
    globalApi<{ features: FeatureRow[] }>('/admin/features')
      .then((d) => setFeatures(d.features))
      .catch(() => undefined);
    globalApi<{ settings: SystemSettingRow[] }>('/admin/settings')
      .then((d) => setSettings(d.settings))
      .catch(() => undefined);
    globalApi<AdminReport>('/admin/reports')
      .then(setReport)
      .catch(() => undefined);
  }, [router]);

  async function toggleCompany(c: CompanyRow) {
    setBusy(true);
    setError(null);
    try {
      const next = c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await globalApi(`/admin/companies/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      setCompanies((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
      setNotice(next === 'ACTIVE' ? `تم تفعيل الشركة ${c.nameAr}` : `تم تعطيل الشركة ${c.nameAr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const str = (k: string) => (fd.get(k) ? String(fd.get(k)).trim() : '');
    const ownerName = str('ownerName');
    const ownerEmail = str('ownerEmail');
    const ownerPhone = str('ownerPhone');
    const ownerPassword = str('ownerPassword');

    const payload: {
      code: string;
      nameAr: string;
      phone?: string;
      email?: string;
      contactName?: string;
      owner?: { name: string; email?: string; phone?: string; password: string };
    } = { code: str('code'), nameAr: str('nameAr') };
    if (str('phone')) payload.phone = str('phone');
    if (str('email')) payload.email = str('email');
    if (str('contactName')) payload.contactName = str('contactName');
    if (ownerName || ownerEmail || ownerPhone || ownerPassword) {
      payload.owner = { name: ownerName, password: ownerPassword };
      if (ownerEmail) payload.owner.email = ownerEmail;
      if (ownerPhone) payload.owner.phone = ownerPhone;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await globalApi<{
        company: CompanyRow;
        owner: { id: number; name: string } | null;
      }>('/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setCompanies((cs) => [...cs, { ...res.company, usersCount: res.owner ? 1 : 0 }]);
      setNotice(
        `تم إنشاء الشركة ${res.company.nameAr}${res.owner ? ` مع المالك ${res.owner.name}` : ''}`,
      );
      setShowCreate(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الشركة');
    } finally {
      setBusy(false);
    }
  }

  async function toggleGlobalFeature(f: FeatureRow) {
    setBusy(true);
    setError(null);
    try {
      const next = !f.enabled;
      await globalApi(`/admin/features/${f.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      setFeatures((fs) => fs.map((x) => (x.code === f.code ? { ...x, enabled: next } : x)));
      setNotice(`${f.nameAr}: ${next ? 'مفعّلة عاماً' : 'معطّلة عاماً'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setBusy(false);
    }
  }

  function loadCompanyFeatures(id: number) {
    setExpandedCompany(expandedCompany === id ? null : id);
    if (companyFeatures[id]) return;
    globalApi<{ features: CompanyFeatureView[] }>(`/admin/companies/${id}/features`)
      .then((d) => setCompanyFeatures((m) => ({ ...m, [id]: d.features })))
      .catch(() => undefined);
  }

  async function setCompanyFeature(id: number, code: string, v: boolean | null) {
    try {
      if (v === null) {
        await globalApi(`/admin/companies/${id}/feature/${code}`, { method: 'DELETE' });
      } else {
        await globalApi(`/admin/companies/${id}/feature/${code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: v }),
        });
      }
      const d = await globalApi<{ features: CompanyFeatureView[] }>(`/admin/companies/${id}/features`);
      setCompanyFeatures((m) => ({ ...m, [id]: d.features }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    }
  }

  function loadFeatureUsers(code: string) {
    setExpandedFeature(expandedFeature === code ? null : code);
    if (featureUsers[code]) return;
    globalApi<{ users: FeatureUser[] }>(`/admin/features/${code}/users`)
      .then((d) => setFeatureUsers((m) => ({ ...m, [code]: d.users })))
      .catch(() => undefined);
  }

  async function setUserFeature(userId: number, code: string, v: boolean | null) {
    try {
      if (v === null) {
        await globalApi(`/admin/users/${userId}/feature/${code}`, { method: 'DELETE' });
      } else {
        await globalApi(`/admin/users/${userId}/feature/${code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: v }),
        });
      }
      const d = await globalApi<{ users: FeatureUser[] }>(`/admin/features/${code}/users`);
      setFeatureUsers((m) => ({ ...m, [code]: d.users }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    }
  }

  async function saveSetting(key: string, value: string) {
    setBusy(true);
    setError(null);
    try {
      await globalApi(`/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      setSettings((ss) => ss.map((x) => (x.key === key ? { ...x, value } : x)));
      setNotice(`تم حفظ الإعداد ${key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإعداد');
    } finally {
      setBusy(false);
    }
  }

  async function removeSetting(key: string) {
    if (!confirm(`حذف الإعداد ${key}؟`)) return;
    setBusy(true);
    setError(null);
    try {
      await globalApi(`/admin/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
      setSettings((ss) => ss.filter((x) => x.key !== key));
      setNotice(`تم حذف الإعداد ${key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف الإعداد');
    } finally {
      setBusy(false);
    }
  }

  function addSetting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const key = String(fd.get('key') ?? '').trim();
    const value = String(fd.get('value') ?? '');
    if (!key) return;
    void saveSetting(key, value).then(() => form.reset());
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl p-6">
      <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <BayanMark size={42} withGlow={true} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-gray-900">الإدارة العامة للمنصة</h1>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-mono font-bold text-blue-700 border border-blue-200">
                SaaS Superadmin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">إدارة المستأجرين والتراخيص والميزات والتقارير العامة</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200">
            <span className="text-[11px] text-slate-400 font-medium">بواسطة</span>
            <MiBLogo height={18} theme="light" />
          </div>
          <button
            onClick={() => {
              window.localStorage.removeItem('bayan-global-token');
              router.replace('/global/login');
            }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            خروج
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        {(
          [
            ['companies', 'الشركات'],
            ['features', 'الميزات'],
            ['reports', 'التقارير'],
            ['settings', 'الإعدادات'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${
              tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
      {notice ? <Notice type="success">{notice}</Notice> : null}

      {tab === 'companies' ? (
        <div className="mb-4">
          <Button variant="primary" disabled={busy} onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? 'إلغاء' : 'إضافة شركة'}
          </Button>
        </div>
      ) : null}

      {tab === 'companies' && showCreate ? (
        <form
          onSubmit={(e) => void submitCreate(e)}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
        >
          <h2 className="mb-3 text-sm font-bold text-gray-800">شركة جديدة</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-gray-600">
              الكود *
              <input name="code" required placeholder="acme" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              الاسم *
              <input name="nameAr" required placeholder="شركة أكيم" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              الهاتف
              <input name="phone" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              البريد
              <input name="email" type="email" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              المسؤول
              <input name="contactName" className={inputCls} />
            </label>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-bold text-gray-800">المالك الأول (اختياري)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-gray-600">
              الاسم
              <input name="ownerName" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              البريد أو الهاتف (للدخول)
              <input name="ownerEmail" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              الهاتف
              <input name="ownerPhone" className={inputCls} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              كلمة المرور
              <input name="ownerPassword" type="password" className={inputCls} />
            </label>
          </div>

          <div className="mt-4">
            <Button type="submit" variant="primary" disabled={busy}>
              إنشاء الشركة
            </Button>
          </div>
        </form>
      ) : null}

      {tab === 'companies' ? (
        <div className="space-y-3">
          {companies.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{c.nameAr}</span>
                    <Badge color={c.status === 'ACTIVE' ? 'green' : 'red'}>
                      {c.status === 'ACTIVE' ? 'مفعّلة' : 'معطّلة'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    الكود: {c.code} — المستخدمون: {c.usersCount}
                    {c.contactName ? ` — المسؤول: ${c.contactName}` : ''}
                  </div>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => loadCompanyFeatures(c.id)}>
                  {expandedCompany === c.id ? 'إخفاء الميزات' : 'الميزات'}
                </Button>
                <Button
                  variant={c.status === 'ACTIVE' ? 'danger' : 'primary'}
                  disabled={busy}
                  onClick={() => toggleCompany(c)}
                >
                  {c.status === 'ACTIVE' ? 'تعطيل الشركة' : 'تفعيل الشركة'}
                </Button>
              </div>
              {expandedCompany === c.id ? (
                <div className="border-t border-gray-100 p-4">
                  <table className="w-full text-sm">
                    <tbody>
                      {(companyFeatures[c.id] ?? []).map((f) => (
                        <tr key={f.code} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 font-medium text-gray-800">{f.nameAr}</td>
                          <td className="py-2 text-xs text-gray-400">{f.code}</td>
                          <td className="py-2 text-left">
                            <TriSwitch
                              value={
                                expandedCompany === c.id && companyFeatures[c.id]
                                  ? (f.companyOverride ?? null)
                                  : null
                              }
                              onChange={(v) => void setCompanyFeature(c.id, f.code, v)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-gray-400">
                    «تلقائي» يعني اتباع الحالة العامة؛ وتجاوز الشركة يخصّص الميزة لهذه الشركة وحدها.
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : tab === 'features' ? (
        <div className="space-y-3">
          {features.map((f) => (
            <div key={f.code} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{f.nameAr}</span>
                    <Badge color={f.enabled ? 'green' : 'red'}>{f.enabled ? 'عامة مفعّلة' : 'عامة معطّلة'}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {f.code} — استثناءات مستخدمين: {f.userOverrides} — استثناءات شركات: {f.companyOverrides}
                  </div>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => loadFeatureUsers(f.code)}>
                  {expandedFeature === f.code ? 'إخفاء المستخدمين' : 'مستخدمون'}
                </Button>
                <Button variant={f.enabled ? 'danger' : 'primary'} disabled={busy} onClick={() => toggleGlobalFeature(f)}>
                  {f.enabled ? 'إطفاء عام' : 'تشغيل عام'}
                </Button>
              </div>
              {expandedFeature === f.code ? (
                <div className="border-t border-gray-100 p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-gray-400">
                        <th className="py-1 font-medium">المستخدم</th>
                        <th className="py-1 font-medium">الشركة</th>
                        <th className="py-1 font-medium">الدور</th>
                        <th className="py-1 text-left font-medium">الاستثناء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(featureUsers[f.code] ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 font-medium text-gray-800">
                            {u.name}
                            {u.repCode ? <span className="text-xs text-gray-400"> ({u.repCode})</span> : null}
                          </td>
                          <td className="py-2 text-gray-600">{u.company?.nameAr ?? '—'}</td>
                          <td className="py-2 text-gray-600">{u.roleCode}</td>
                          <td className="py-2 text-left">
                            <TriSwitch
                              value={featureUsers[f.code] ? (u.override ?? null) : null}
                              onChange={(v) => void setUserFeature(u.id, f.code, v)}
                            />
                          </td>
                        </tr>
                      ))}
                      {(featureUsers[f.code] ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 text-center text-sm text-gray-400">
                            لا يوجد مستخدمون
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : tab === 'reports' ? (
        report ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['الشركات', `${report.totals.companies} (${report.totals.activeCompanies} مفعّلة)`],
                ['المستخدمون', fmtNum(report.totals.users)],
                ['الأصناف', fmtNum(report.totals.items)],
                ['العملاء', fmtNum(report.totals.customers)],
                ['بيانات معتمدة', fmtNum(report.totals.statements)],
                ['صافي المبيعات', fmtNum(report.totals.netSales)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-medium text-gray-400">{label}</div>
                  <div className="mt-1 text-lg font-black text-gray-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold text-gray-800">تقرير الشركات</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-xs text-gray-400">
                      <th className="py-1 font-medium">الشركة</th>
                      <th className="py-1 font-medium">الحالة</th>
                      <th className="py-1 font-medium">المستخدمون</th>
                      <th className="py-1 font-medium">الأصناف</th>
                      <th className="py-1 font-medium">العملاء</th>
                      <th className="py-1 font-medium">بيانات معتمدة</th>
                      <th className="py-1 font-medium">صافي المبيعات</th>
                      <th className="py-1 font-medium">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.companies.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium text-gray-800">
                          {c.nameAr} <span className="text-xs text-gray-400">({c.code})</span>
                        </td>
                        <td className="py-2">
                          <Badge color={c.status === 'ACTIVE' ? 'green' : 'red'}>
                            {c.status === 'ACTIVE' ? 'مفعّلة' : 'معطّلة'}
                          </Badge>
                        </td>
                        <td className="py-2 text-gray-600">{fmtNum(c.users)}</td>
                        <td className="py-2 text-gray-600">{fmtNum(c.items)}</td>
                        <td className="py-2 text-gray-600">{fmtNum(c.customers)}</td>
                        <td className="py-2 text-gray-600">{fmtNum(c.statements)}</td>
                        <td className="py-2 text-gray-600">{fmtNum(c.netSales)}</td>
                        <td className="py-2 text-gray-500">
                          {c.lastStatementAt ? new Date(c.lastStatementAt).toLocaleDateString('ar-EG') : '—'}
                        </td>
                      </tr>
                    ))}
                    {report.companies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-3 text-center text-sm text-gray-400">
                          لا توجد شركات
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              صافي المبيعات = مجموع صافي البيانات المعتمدة لكل شركة؛ الأرقام تجمع الشركات وقد تختلف
              العملات بينها. البيانات تُجلب من سياق كل شركة (RLS).
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            جارٍ تحميل التقارير…
          </div>
        )
      ) : (
        <div className="space-y-4">
          <form onSubmit={addSetting} className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-gray-800">إضافة / تحديث إعداد</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-gray-600">
                المفتاح *
                <input name="key" required placeholder="stock.sale.enforce" className={inputCls} />
              </label>
              <label className="text-xs font-medium text-gray-600">
                القيمة *
                <input name="value" required placeholder="ALLOW" className={inputCls} />
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="primary" disabled={busy}>
                  حفظ
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              إعدادات النظام العامة مثل <code>stocktake.freeze.mode</code> (BLOCK/WARN) و{' '}
              <code>stock.sale.enforce</code> (ALLOW/BLOCK).
            </p>
          </form>

          <div className="space-y-2">
            {settings.map((s) => (
              <SettingRow
                key={s.key}
                setting={s}
                busy={busy}
                onSave={(v) => void saveSetting(s.key, v)}
                onRemove={() => void removeSetting(s.key)}
              />
            ))}
            {settings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                لا توجد إعدادات
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}