'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAuth, useAuth } from '@/lib/auth';
import { can } from '@/lib/api';

type NavLink = { href: string; label: string; phase: number; perm?: string; feature?: string };

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, featureEnabled } = useAuth();

  const links: NavLink[] = [
    { href: '/statements', label: 'بيانات الأسعار', phase: 2 },
    { href: '/quotations', label: 'عروض الأسعار', phase: 2 },
    { href: '/returns', label: 'مرتجعات', phase: 2 },
    { href: '/purchases', label: 'توريد', phase: 2 },
    { href: '/purchase-orders', label: 'أوامر الشراء', phase: 2 },
    { href: '/supplier-returns', label: 'مرتجعات المشتريات', phase: 2 },
    { href: '/collections', label: 'تحصيل وخزينة', phase: 2 },
    { href: '/treasury', label: 'الخزينة والإقفال', phase: 2 },
    { href: '/approvals', label: 'الموافقات', phase: 2 },
    { href: '/stocktakes', label: 'جلسات الجرد', phase: 3 },
    { href: '/transfers', label: 'التحويلات المخزنية', phase: 3 },
    { href: '/reports', label: 'التقارير والتقييم', phase: 3 },
    { href: '/reps', label: 'المتابعة الميدانية', phase: 5 },
    { href: '/geo', label: 'تتبع المندوبين', phase: 5, feature: 'geotracking.fleet' },
    { href: '/visit-plans', label: 'خطط الزيارات', phase: 5 },
    { href: '/targets', label: 'التارجت والعمولات', phase: 5 },
    { href: '/archives', label: 'الترحيل والأرشفة', phase: 6, feature: 'archiving.core' },
    { href: '/backups', label: 'النسخ الاحتياطي', phase: 6 },
    { href: '/notifications', label: 'الإشعارات', phase: 6 },
    { href: '/audit-logs', label: 'سجل التدقيق', phase: 6 },
    { href: '/items', label: 'الأصناف', phase: 1 },
    { href: '/prices', label: 'الأسعار والتسعير', phase: 1 },
    { href: '/special-prices', label: 'الأسعار الخاصة', phase: 1 },
    { href: '/customers', label: 'العملاء', phase: 1 },
    { href: '/suppliers', label: 'الموردون', phase: 1 },
    { href: '/warehouses', label: 'المخازن', phase: 1 },
    { href: '/categories', label: 'التصنيفات', phase: 1 },
    { href: '/brands', label: 'الماركات', phase: 1 },
    { href: '/branches', label: 'الفروع', phase: 1 },
    { href: '/users', label: 'المستخدمون والأدوار', phase: 1 },
    { href: '/devices', label: 'الأجهزة والأمان', phase: 1 },
    { href: '/settings', label: 'إعدادات الشركة', phase: 1, perm: 'company.manage' },
    { href: '/tools', label: 'أدوات مساعدة', phase: 1 },
  ];

  const groups = [
    { title: 'المبيعات والشراء', phase: 2 },
    { title: 'المخزون والجرد', phase: 3 },
    { title: 'البيانات الأساسية', phase: 1 },
    { title: 'المتابعة الميدانية', phase: 5 },
    { title: 'الأرشفة والصيانة', phase: 6 },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg font-black text-white">
            ب
          </span>
          <div>
            <div className="text-sm font-black text-gray-900">نظام بيان</div>
            <div className="text-xs text-gray-400">الإصدار 1.0</div>
          </div>
        </div>
        <div className="border-b border-gray-200 px-3 py-2">
          <Link
            href="/dashboard"
            className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              pathname?.startsWith('/dashboard')
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            لوحة المعلومات
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {groups.map((group) => (
            <div key={group.title} className="mb-2">
              <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {group.title}
              </div>
              {links
                .filter(
                  (l) =>
                    l.phase === group.phase &&
                    (!l.perm || can(user, l.perm)) &&
                    (!l.feature || featureEnabled(l.feature)),
                )
                .map((link) => {
                  const active = pathname?.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`mb-0.5 block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <div className="mb-2 px-2 text-sm font-semibold text-gray-800">{user?.name}</div>
          <button
            onClick={logout}
            className="rounded-lg px-2 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}