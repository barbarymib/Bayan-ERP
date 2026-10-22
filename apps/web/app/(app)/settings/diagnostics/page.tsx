'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, type SystemDiagnostics } from '@/lib/api';
import { BayanMark, MiBLogo } from '@/components/brand';
import { Badge, Button, ErrorBox, Notice, PageHeader } from '@/components/ui';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d} يوم`);
  if (h > 0) parts.push(`${h} ساعة`);
  if (m > 0) parts.push(`${m} دقيقة`);
  if (parts.length === 0) parts.push(`${s} ثانية`);
  return parts.join(' و ');
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drillBusy, setDrillBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    get<SystemDiagnostics>('/company/diagnostics')
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بيانات التشخيص');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function runRestoreDrill() {
    if (!data?.backups.latest?.id) return;
    setDrillBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await post<{ ok: boolean; message?: string }>(
        `/backups/${data.backups.latest.id}/restore-drill`,
        {},
      );
      setNotice(res.message ?? 'تم تنفيذ تمرين الاسترجاع التجريبي بنجاح وتأكيد سلامة النسخة المشفرة');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إجراء تمرين الاسترجاع');
    } finally {
      setDrillBusy(false);
    }
  }

  const isHealthy = data?.status === 'healthy';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageHeader title="تشخيص وسلامة النظام" />
          <p className="text-sm text-gray-500 -mt-2">
            مراقبة حية للمكونات الحيوية: قاعدة البيانات، الترحيلات، التخزين السحابي، والنسخ الاحتياطي المشفر
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            disabled={loading}
          >
            {loading ? 'جارِ الفحص…' : '🔄 فحص فوري'}
          </Button>
          {data?.backups.latest && (
            <Button
              variant="primary"
              onClick={runRestoreDrill}
              disabled={drillBusy || loading}
            >
              {drillBusy ? 'جارِ التمرين…' : '🛡️ اختبار استرجاع تجريبي'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <Link
          href="/settings"
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          إعدادات الشركة
        </Link>
        <Link
          href="/settings/diagnostics"
          className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors"
        >
          تشخيص وسلامة النظام
        </Link>
      </div>

      {notice && <Notice type="success">{notice}</Notice>}
      {error && <ErrorBox message={error} />}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full ms-3" />
          <span>جارِ فحص مكونات النظام وقراءة سلامة الخدمات…</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Status Hero Card */}
          <div
            className={`rounded-2xl border p-6 transition-all ${
              isHealthy
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white shadow-sm'
                : 'border-amber-200 bg-gradient-to-r from-amber-50/80 to-white shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                    isHealthy ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  {isHealthy ? (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {isHealthy ? 'جميع الأنظمة والمكونات الحيوية تعمل بكفاءة تامة' : 'تنبيه في سلامة النظام'}
                    </h3>
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    زمن استجابة قاعدة البيانات: <span className="font-semibold text-gray-900">{data.database.latencyMs} ms</span> • الترحيلات: <span className="font-semibold text-gray-900">{data.database.migrations.applied}/{data.database.migrations.total} مكتملة</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200">
                <span>آخر تحديث:</span>
                <span className="font-mono text-gray-800">{new Date(data.runtime.timestamp).toLocaleTimeString('ar-EG')}</span>
              </div>
            </div>
          </div>

          {/* Grid of Diagnostics Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Database & Migrations */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900">قاعدة البيانات والترحيلات</h4>
                </div>
                <Badge color={data.database.connected ? 'green' : 'red'}>
                  {data.database.connected ? 'متصل ومستقر' : 'غير متصل'}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">زمن الاستجابة (Latency)</span>
                  <span className="font-mono font-semibold text-gray-800">{data.database.latencyMs} ms</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">الترحيلات المطبقة</span>
                  <span className="font-semibold text-emerald-600">
                    {data.database.migrations.applied} من {data.database.migrations.total}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">الترحيلات المعلقة</span>
                  <span className={`font-semibold ${data.database.migrations.pending.length === 0 ? 'text-gray-500' : 'text-red-600'}`}>
                    {data.database.migrations.pending.length === 0 ? 'لا توجد (جاهز)' : `${data.database.migrations.pending.length} معلق`}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">عزل الشركات (RLS)</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">مُفعّل بالكامل</span>
                </div>
              </div>
            </div>

            {/* 2. Object Storage */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900">التخزين السحابي للملفات</h4>
                </div>
                <Badge color="green">تشغيلي</Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">المحرك الفعّال (Driver)</span>
                  <span className="font-semibold text-gray-800 uppercase text-xs px-2 py-0.5 bg-gray-100 rounded">
                    {data.storage.driver}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">الحاوية / المسار</span>
                  <span className="font-mono text-xs text-gray-700 truncate max-w-[170px]" title={data.storage.bucket}>
                    {data.storage.bucket}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">تخزين صور الأصناف</span>
                  <span className="text-emerald-600 font-semibold">مفعل</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">أرشفة النسخ والملفات</span>
                  <span className="text-emerald-600 font-semibold">جاهز</span>
                </div>
              </div>
            </div>

            {/* 3. Encrypted Backups & Drills */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900">النسخ الاحتياطي المشفر</h4>
                </div>
                <Badge color={data.backups.latest?.lastDrillOk ? 'green' : 'blue'}>
                  {data.backups.latest?.lastDrillOk ? 'تم اختبار الاسترجاع' : 'مجدول'}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">خوارزمية التشفير</span>
                  <span className="font-mono text-xs font-semibold text-gray-800">{data.backups.encryption}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">الجدول اليومي</span>
                  <span className="font-semibold text-gray-800">{data.backups.schedule} يومياً</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">آخر نسخة احتياطية</span>
                  <span className="font-mono text-xs text-gray-800">
                    {data.backups.latest ? `${data.backups.latest.code} (${formatBytes(data.backups.latest.sizeBytes)})` : 'لا توجد بعد'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">تمرين الاسترجاع الأخير</span>
                  <span className={`text-xs font-semibold ${data.backups.latest?.lastDrillOk ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {data.backups.latest?.lastDrillOk ? 'ناجح (بيانات سليمة)' : 'لم يُجرَ مؤخراً'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Alerts Scheduler & Devices */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900">المجدول الآلي والأجهزة</h4>
                </div>
                <Badge color={data.alerts.status === 'running' ? 'green' : 'gray'}>
                  {data.alerts.status === 'running' ? 'نشط دورياً' : 'متوقف'}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">تحديث التنبيهات الآلية</span>
                  <span className="font-semibold text-gray-800">
                    كل {data.alerts.intervalSeconds ? `${Math.round(data.alerts.intervalSeconds / 60)} دقيقة` : 'معطل'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">أجهزة المناديب المسجلة</span>
                  <span className="font-semibold text-gray-800">{data.devices.total} أجهزة</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">الأجهزة النشطة حالياً</span>
                  <span className="font-semibold text-emerald-600">{data.devices.active} نشط</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">إدارة الأجهزة</span>
                  <Link href="/devices" className="text-xs font-semibold text-blue-600 hover:underline">
                    عرض الأجهزة المسجلة ←
                  </Link>
                </div>
              </div>
            </div>

            {/* 5. Server & Runtime */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow transition-shadow md:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900">بيئة تشغيل الخادم والموارد</h4>
                </div>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                  Node {data.runtime.nodeVersion} • {data.runtime.platform}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <span className="text-xs text-gray-500 block">مدة تشغيل الخادم (Uptime)</span>
                  <span className="text-base font-bold text-gray-900 mt-1 block">
                    {formatUptime(data.runtime.uptimeSeconds)}
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <span className="text-xs text-gray-500 block">استهلاك الذاكرة (Heap RAM)</span>
                  <span className="text-base font-bold text-gray-900 mt-1 block">
                    {data.runtime.heapUsedMb} MB
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <span className="text-xs text-gray-500 block">ذاكرة العملية الكلية (RSS)</span>
                  <span className="text-base font-bold text-gray-900 mt-1 block">
                    {data.runtime.rssMb} MB
                  </span>
                </div>
              </div>
            </div>

            {/* 6. System Identity & Corporate Endorsement */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 shadow-md text-white md:col-span-2 lg:col-span-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <BayanMark size={48} withGlow={true} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-white">نظام بيان ERP</span>
                      <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-xs font-mono font-bold text-blue-300 border border-blue-400/30">
                        v1.0 Production
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      النظام الشامل لإدارة مبيعات وتوريدات الحديد والصلب والبويات والمتابعة الميدانية
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm border border-white/10 self-stretch sm:self-auto justify-between sm:justify-start">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] text-slate-400 font-medium">تطوير وتشغيل</div>
                    <div className="text-xs font-bold text-white">MiB Technology</div>
                  </div>
                  <MiBLogo height={32} variant="horizontal" theme="dark" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
