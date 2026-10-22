'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RequireAuth, useAuth } from '@/lib/auth';
import { can } from '@/lib/api';
import { CommandPalette } from '@/components/command-palette';
import {
  IconApproval,
  IconArchive,
  IconAudit,
  IconBackup,
  IconBranch,
  IconBrand,
  IconCategory,
  IconClose,
  IconCollection,
  IconCustomer,
  IconDashboard,
  IconDevice,
  IconDiagnostics,
  IconGeo,
  IconItem,
  IconLogOut,
  IconMenu,
  IconNotification,
  IconPlan,
  IconPos,
  IconPrice,
  IconPurchase,
  IconPurchaseOrder,
  IconReport,
  IconRep,
  IconReturn,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconStatement,
  IconStocktake,
  IconSupplier,
  IconSupplierReturn,
  IconTarget,
  IconTools,
  IconTransfer,
  IconTreasury,
  IconUser,
  IconWarehouse,
  type IconProps,
} from '@/components/icons';

interface NavLinkItem {
  href: string;
  label: string;
  phase: number;
  icon: (props: IconProps) => ReactNode;
  perm?: string;
  feature?: string;
  badge?: string;
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, featureEnabled } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const links: NavLinkItem[] = [
    // Phase 2: المبيعات والشراء
    { href: '/pos', label: 'نقطة بيع سريعة (POS)', phase: 2, icon: IconPos, badge: 'سريع' },
    { href: '/statements', label: 'بيانات الأسعار', phase: 2, icon: IconStatement },
    { href: '/quotations', label: 'عروض الأسعار', phase: 2, icon: IconStatement },
    { href: '/returns', label: 'مرتجعات العملاء', phase: 2, icon: IconReturn },
    { href: '/purchases', label: 'فواتير التوريد', phase: 2, icon: IconPurchase },
    { href: '/purchase-orders', label: 'أوامر الشراء', phase: 2, icon: IconPurchaseOrder },
    { href: '/supplier-returns', label: 'مرتجعات الموردين', phase: 2, icon: IconSupplierReturn },
    { href: '/collections', label: 'تحصيل وقبض', phase: 2, icon: IconCollection },
    { href: '/treasury', label: 'الخزينة والإقفال', phase: 2, icon: IconTreasury },
    { href: '/approvals', label: 'الموافقات والاعتمادات', phase: 2, icon: IconApproval },

    // Phase 3: المخزون والجرد
    { href: '/stocktakes', label: 'جلسات الجرد', phase: 3, icon: IconStocktake },
    { href: '/transfers', label: 'التحويلات المخزنية', phase: 3, icon: IconTransfer },
    { href: '/reports', label: 'التقارير والتقييم', phase: 3, icon: IconReport },

    // Phase 5: المتابعة الميدانية
    { href: '/reps', label: 'المتابعة الميدانية', phase: 5, icon: IconRep },
    { href: '/geo', label: 'تتبع المناديب', phase: 5, icon: IconGeo, feature: 'geotracking.fleet' },
    { href: '/visit-plans', label: 'خطط الزيارات', phase: 5, icon: IconPlan },
    { href: '/targets', label: 'التارجت والعمولات', phase: 5, icon: IconTarget },

    // Phase 6: الأرشفة والصيانة
    { href: '/archives', label: 'الترحيل والأرشفة', phase: 6, icon: IconArchive, perm: 'archive.run', feature: 'archiving.core' },
    { href: '/backups', label: 'النسخ الاحتياطي', phase: 6, icon: IconBackup },
    { href: '/notifications', label: 'الإشعارات والتنبيهات', phase: 6, icon: IconNotification },
    { href: '/audit-logs', label: 'سجل التدقيق', phase: 6, icon: IconAudit, perm: 'audit.view' },

    // Phase 1: البيانات الأساسية
    { href: '/items', label: 'الأصناف والمخزون', phase: 1, icon: IconItem },
    { href: '/prices', label: 'قوائم الأسعار', phase: 1, icon: IconPrice },
    { href: '/special-prices', label: 'الأسعار الخاصة', phase: 1, icon: IconSparkles },
    { href: '/customers', label: 'العملاء', phase: 1, icon: IconCustomer },
    { href: '/suppliers', label: 'الموردون', phase: 1, icon: IconSupplier },
    { href: '/warehouses', label: 'المستودعات والمخازن', phase: 1, icon: IconWarehouse },
    { href: '/categories', label: 'التصنيفات', phase: 1, icon: IconCategory },
    { href: '/brands', label: 'الماركات التجارية', phase: 1, icon: IconBrand },
    { href: '/branches', label: 'الفروع', phase: 1, icon: IconBranch },
    { href: '/users', label: 'المستخدمون والأدوار', phase: 1, icon: IconUser, perm: 'user.view' },
    { href: '/devices', label: 'الأجهزة والأمان', phase: 1, icon: IconDevice, perm: 'device.manage' },
    { href: '/settings', label: 'إعدادات الشركة', phase: 1, icon: IconSettings, perm: 'company.manage' },
    { href: '/settings/diagnostics', label: 'سلامة النظام', phase: 1, icon: IconDiagnostics, perm: 'company.manage' },
    { href: '/tools', label: 'أدوات مساعدة', phase: 1, icon: IconTools },
  ];

  const groups = [
    { title: 'المبيعات والشراء', phase: 2 },
    { title: 'المخزون والجرد', phase: 3 },
    { title: 'المتابعة الميدانية', phase: 5 },
    { title: 'البيانات الأساسية', phase: 1 },
    { title: 'الأرشفة والصيانة', phase: 6 },
  ];

  // Render navigation links list
  const renderNavContent = (closeMobile?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Brand & Version */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-xl font-black text-white shadow-sm ring-1 ring-blue-500/30">
            ب
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>نظام بيان</span>
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-200/60">
                ERP
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">مبيعات الحديد والبويات</div>
          </div>
        </div>
      </div>

      {/* Quick Search & Dashboard Bar */}
      <div className="p-3 space-y-2 border-b border-slate-100 bg-slate-50/50">
        <button
          onClick={() => {
            closeMobile?.();
            setSearchOpen(true);
          }}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800 transition-all shadow-2xs group"
        >
          <span className="flex items-center gap-2">
            <IconSearch size={15} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span>بحث سريع…</span>
          </span>
          <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200">
            Ctrl+K
          </kbd>
        </button>

        <Link
          href="/dashboard"
          onClick={() => closeMobile?.()}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
            pathname?.startsWith('/dashboard')
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-white hover:text-slate-900'
          }`}
        >
          <IconDashboard size={18} className={pathname?.startsWith('/dashboard') ? 'text-white' : 'text-slate-500'} />
          <span>لوحة المعلومات الحية</span>
        </Link>
      </div>

      {/* Grouped Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {groups.map((group) => {
          const groupLinks = links.filter(
            (l) =>
              l.phase === group.phase &&
              (!l.perm || can(user, l.perm)) &&
              (!l.feature || featureEnabled(l.feature)),
          );

          if (groupLinks.length === 0) return null;

          return (
            <div key={group.title}>
              <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {groupLinks.map((link) => {
                  const active = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => closeMobile?.()}
                      className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-bold border-r-3 border-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          size={17}
                          className={`shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                        />
                        <span className="truncate">{link.label}</span>
                      </div>
                      {link.badge ? (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                          {link.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="border-t border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">
              {user?.name ? user.name.slice(0, 1) : 'م'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-slate-900">{user?.name}</div>
              <div className="truncate text-[10px] text-slate-400 font-semibold">{user?.roleCode}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="تسجيل الخروج"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <IconLogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white shadow-2xs">
        {renderNavContent()}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden flex" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />
          <div
            className="relative mr-auto flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl animate-entrance"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-3 top-3 z-10">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconClose size={18} />
              </button>
            </div>
            {renderNavContent(() => setMobileMenuOpen(false))}
          </div>
        </div>
      ) : null}

      {/* Main Area with Top Header */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Responsive Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="القائمة الجانبية"
            >
              <IconMenu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="font-bold text-slate-800">بيان ERP</span>
              <span>/</span>
              <span className="capitalize">{pathname?.split('/')[1] || 'لوحة المعلومات'}</span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <IconSearch size={15} />
              <span className="hidden sm:inline">بحث سريع…</span>
              <kbd className="hidden sm:inline rounded bg-white px-1 text-[10px] text-slate-400 border border-slate-200">
                ⌘K
              </kbd>
            </button>

            <Link
              href="/pos"
              className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors"
            >
              <IconPos size={14} />
              <span>نقطة بيع</span>
            </Link>

            <Link
              href="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              title="الإشعارات والتنبيهات"
            >
              <IconNotification size={18} />
            </Link>

            <div className="hidden md:flex items-center gap-2 border-r border-slate-200 pr-2 mr-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                متصل
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
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