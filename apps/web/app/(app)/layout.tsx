'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RequireAuth, useAuth } from '@/lib/auth';
import { can } from '@/lib/api';
import { BayanLogo, BayanMark, MiBLogo } from '@/components/brand';
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
  IconChevronDown,
  IconSidebarCollapse,
  IconSidebarExpand,
  IconBolt,
  type IconProps,
} from '@/components/icons';

interface NavLinkItem {
  href: string;
  label: string;
  groupId: string;
  icon: (props: IconProps) => ReactNode;
  perm?: string;
  feature?: string;
  badge?: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: (props: IconProps) => ReactNode;
  accent: {
    bg: string;
    text: string;
    dot: string;
  };
}

const navGroups: NavGroup[] = [
  {
    id: 'sales',
    title: 'المبيعات والمشتريات',
    icon: IconPos,
    accent: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      dot: 'bg-blue-600',
    },
  },
  {
    id: 'inventory',
    title: 'المخزون والمستودعات',
    icon: IconWarehouse,
    accent: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-600',
    },
  },
  {
    id: 'field',
    title: 'المتابعة الميدانية والمناديب',
    icon: IconRep,
    accent: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      dot: 'bg-purple-600',
    },
  },
  {
    id: 'master',
    title: 'البيانات والتعريفات الأساسية',
    icon: IconItem,
    accent: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      dot: 'bg-amber-600',
    },
  },
  {
    id: 'system',
    title: 'الأمان والتشخيص والأرشفة',
    icon: IconSettings,
    accent: {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      dot: 'bg-slate-600',
    },
  },
];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout, featureEnabled } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group expansion state with initial defaults
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    sales: true,
    inventory: true,
    field: true,
    master: false,
    system: false,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const savedCollapsed = window.localStorage.getItem('bayan_sidebar_collapsed');
        if (savedCollapsed !== null) {
          setIsCollapsed(savedCollapsed === 'true');
        }
        const savedGroups = window.localStorage.getItem('bayan_sidebar_groups');
        if (savedGroups) {
          setOpenGroups((prev) => ({ ...prev, ...JSON.parse(savedGroups) }));
        }
      } catch {
        // ignore
      }
    });
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('bayan_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        window.localStorage.setItem('bayan_sidebar_groups', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+K and Ctrl+B
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const links: NavLinkItem[] = useMemo(
    () => [
      // Phase 2: المبيعات والشراء
      { href: '/pos', label: 'نقطة بيع سريعة (POS)', groupId: 'sales', icon: IconPos, badge: 'سريع' },
      { href: '/statements', label: 'بيانات الأسعار', groupId: 'sales', icon: IconStatement },
      { href: '/quotations', label: 'عروض الأسعار', groupId: 'sales', icon: IconStatement },
      { href: '/returns', label: 'مرتجعات العملاء', groupId: 'sales', icon: IconReturn },
      { href: '/purchases', label: 'فواتير التوريد', groupId: 'sales', icon: IconPurchase },
      { href: '/purchase-orders', label: 'أوامر الشراء', groupId: 'sales', icon: IconPurchaseOrder },
      { href: '/supplier-returns', label: 'مرتجعات الموردين', groupId: 'sales', icon: IconSupplierReturn },
      { href: '/collections', label: 'تحصيل وقبض', groupId: 'sales', icon: IconCollection },
      { href: '/treasury', label: 'الخزينة والإقفال', groupId: 'sales', icon: IconTreasury },
      { href: '/approvals', label: 'الموافقات والاعتمادات', groupId: 'sales', icon: IconApproval },

      // Phase 3: المخزون والجرد
      { href: '/stocktakes', label: 'جلسات الجرد', groupId: 'inventory', icon: IconStocktake },
      { href: '/transfers', label: 'التحويلات المخزنية', groupId: 'inventory', icon: IconTransfer },
      { href: '/reports', label: 'التقارير والتقييم', groupId: 'inventory', icon: IconReport },

      // Phase 5: المتابعة الميدانية
      { href: '/reps', label: 'المتابعة الميدانية', groupId: 'field', icon: IconRep },
      { href: '/geo', label: 'تتبع المناديب', groupId: 'field', icon: IconGeo, feature: 'geotracking.fleet' },
      { href: '/visit-plans', label: 'خطط الزيارات', groupId: 'field', icon: IconPlan },
      { href: '/targets', label: 'التارجت والعمولات', groupId: 'field', icon: IconTarget },

      // Phase 1: البيانات الأساسية
      { href: '/items', label: 'الأصناف والمخزون', groupId: 'master', icon: IconItem },
      { href: '/prices', label: 'قوائم الأسعار', groupId: 'master', icon: IconPrice },
      { href: '/special-prices', label: 'الأسعار الخاصة', groupId: 'master', icon: IconSparkles },
      { href: '/customers', label: 'العملاء', groupId: 'master', icon: IconCustomer },
      { href: '/suppliers', label: 'الموردون', groupId: 'master', icon: IconSupplier },
      { href: '/warehouses', label: 'المستودعات والمخازن', groupId: 'master', icon: IconWarehouse },
      { href: '/categories', label: 'التصنيفات', groupId: 'master', icon: IconCategory },
      { href: '/brands', label: 'الماركات التجارية', groupId: 'master', icon: IconBrand },
      { href: '/branches', label: 'الفروع', groupId: 'master', icon: IconBranch },
      { href: '/tools', label: 'أدوات مساعدة', groupId: 'master', icon: IconTools },

      // Phase 6: الأرشفة والصيانة
      { href: '/users', label: 'المستخدمون والأدوار', groupId: 'system', icon: IconUser, perm: 'user.view' },
      { href: '/devices', label: 'الأجهزة والأمان', groupId: 'system', icon: IconDevice, perm: 'device.manage' },
      { href: '/settings', label: 'إعدادات الشركة', groupId: 'system', icon: IconSettings, perm: 'company.manage' },
      { href: '/settings/diagnostics', label: 'سلامة النظام', groupId: 'system', icon: IconDiagnostics, perm: 'company.manage' },
      { href: '/notifications', label: 'الإشعارات والتنبيهات', groupId: 'system', icon: IconNotification },
      { href: '/archives', label: 'الترحيل والأرشفة', groupId: 'system', icon: IconArchive, perm: 'archive.run', feature: 'archiving.core' },
      { href: '/backups', label: 'النسخ الاحتياطي', groupId: 'system', icon: IconBackup },
      { href: '/audit-logs', label: 'سجل التدقيق', groupId: 'system', icon: IconAudit, perm: 'audit.view' },
    ],
    [],
  );

  // Auto-expand group that contains active link on route change
  useEffect(() => {
    if (!pathname) return;
    const activeLink = links.find(
      (l) => pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href)),
    );
    if (activeLink) {
      Promise.resolve().then(() => {
        setOpenGroups((prev) => {
          if (prev[activeLink.groupId]) return prev;
          const next = { ...prev, [activeLink.groupId]: true };
          try {
            window.localStorage.setItem('bayan_sidebar_groups', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      });
    }
  }, [pathname, links]);

  // Render navigation links list
  const renderNavContent = (closeMobile?: () => void, collapsed = false) => {
    if (collapsed) {
      // RAIL (MINI) MODE
      return (
        <div className="flex flex-col h-full items-center py-3 select-none">
          {/* Logo Mark */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <Link href="/dashboard" className="transition-transform hover:scale-105" title="نظام بيان ERP">
              <BayanMark size={38} withGlow={true} />
            </Link>
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              title="توسيع القائمة (Ctrl+B)"
            >
              <IconSidebarExpand size={16} />
            </button>
          </div>

          {/* Quick Actions (Mini) */}
          <div className="flex flex-col items-center gap-2 w-full px-2 pb-3 border-b border-slate-100">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors relative group"
              title="بحث سريع (Ctrl+K)"
            >
              <IconSearch size={18} />
              <div className="pointer-events-none absolute right-full mr-3 z-50 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-slate-700/60 animate-entrance">
                <span>بحث سريع (Ctrl+K)</span>
              </div>
            </button>

            <Link
              href="/pos"
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all relative group shadow-sm ${
                pathname === '/pos'
                  ? 'bg-blue-600 text-white shadow-blue-500/30'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:brightness-110'
              }`}
              title="نقطة بيع سريعة (POS)"
            >
              <IconPos size={18} />
              <div className="pointer-events-none absolute right-full mr-3 z-50 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-slate-700/60 animate-entrance">
                <span>نقطة بيع سريعة (POS)</span>
              </div>
            </Link>

            <Link
              href="/dashboard"
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all relative group ${
                pathname?.startsWith('/dashboard')
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="لوحة المعلومات"
            >
              <IconDashboard size={18} />
              <div className="pointer-events-none absolute right-full mr-3 z-50 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-slate-700/60 animate-entrance">
                <span>لوحة المعلومات</span>
              </div>
            </Link>
          </div>

          {/* Links List (Mini Icons) */}
          <nav className="flex-1 overflow-y-auto w-full px-2 py-3 space-y-3">
            {navGroups.map((group) => {
              const groupLinks = links.filter(
                (l) =>
                  l.groupId === group.id &&
                  (!l.perm || can(user, l.perm)) &&
                  (!l.feature || featureEnabled(l.feature)),
              );
              if (groupLinks.length === 0) return null;

              return (
                <div key={group.id} className="flex flex-col items-center gap-1">
                  <div
                    className="w-5 h-px bg-slate-200 my-1 rounded-full"
                    title={group.title}
                  />
                  {groupLinks.map((link) => {
                    const active = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                    const Icon = link.icon;
                    return (
                      <div key={link.href} className="relative group">
                        <Link
                          href={link.href}
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                            active
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <Icon size={18} />
                        </Link>
                        {/* Floating Tooltip in RTL (appears to the left) */}
                        <div className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 z-50 hidden group-hover:flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-slate-700/60 animate-entrance">
                          <span>{link.label}</span>
                          {link.badge ? (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                              {link.badge}
                            </span>
                          ) : null}
                          <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-slate-900" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User & MiB Emblem (Mini) */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 w-full px-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-xs font-black text-blue-700"
              title={`${user?.name} (${user?.roleCode})`}
            >
              {user?.name ? user.name.slice(0, 1) : 'م'}
            </div>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              title="تسجيل الخروج"
            >
              <IconLogOut size={16} />
            </button>
            <div className="pt-1" title="MiB Technology">
              <MiBLogo height={22} variant="emblem" theme="light" />
            </div>
          </div>
        </div>
      );
    }

    // FULL EXPANDED SIDEBAR MODE
    return (
      <div className="flex flex-col h-full select-none">
        {/* Brand & Collapse Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 bg-gradient-to-b from-white to-slate-50/50">
          <BayanLogo size="md" />
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="تصغير القائمة إلى شريط سريع (Ctrl+B)"
          >
            <IconSidebarCollapse size={16} />
          </button>
        </div>

        {/* Quick Action Station */}
        <div className="p-3 space-y-2 border-b border-slate-100 bg-slate-50/60">
          {/* Quick Search */}
          <button
            onClick={() => {
              closeMobile?.();
              setSearchOpen(true);
            }}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:border-blue-300 hover:text-slate-900 transition-all shadow-2xs group"
          >
            <span className="flex items-center gap-2">
              <IconSearch size={15} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              <span>بحث سريع في النظام…</span>
            </span>
            <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200">
              Ctrl+K
            </kbd>
          </button>

          {/* Quick POS Launch Button */}
          <Link
            href="/pos"
            onClick={() => closeMobile?.()}
            className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:shadow-md hover:brightness-105 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs text-white">
                <IconPos size={15} />
              </span>
              <span>نقطة بيع سريعة (POS)</span>
            </div>
            <span className="flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
              <IconBolt size={12} className="text-amber-300 animate-pulse" />
              مباشر
            </span>
          </Link>

          {/* Dashboard Link */}
          <Link
            href="/dashboard"
            onClick={() => closeMobile?.()}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
              pathname?.startsWith('/dashboard')
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <IconDashboard size={17} className={pathname?.startsWith('/dashboard') ? 'text-white' : 'text-slate-500'} />
              <span>لوحة المعلومات الحية</span>
            </div>
            <span
              className={`h-2 w-2 rounded-full ${
                pathname?.startsWith('/dashboard') ? 'bg-white' : 'bg-emerald-500'
              } animate-pulse`}
            />
          </Link>
        </div>

        {/* Grouped Collapsible Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {navGroups.map((group) => {
            const groupLinks = links.filter(
              (l) =>
                l.groupId === group.id &&
                (!l.perm || can(user, l.perm)) &&
                (!l.feature || featureEnabled(l.feature)),
            );

            if (groupLinks.length === 0) return null;
            const isOpen = openGroups[group.id] !== false;
            const hasActiveChild = groupLinks.some(
              (l) => pathname === l.href || (l.href !== '/' && pathname?.startsWith(l.href)),
            );

            return (
              <div key={group.id} className="rounded-2xl border border-slate-100/80 bg-slate-50/40 p-1.5 transition-colors">
                {/* Accordion Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${group.accent.dot} ${hasActiveChild ? 'ring-2 ring-blue-300' : ''}`} />
                    <span className="text-[11px] font-black text-slate-700 tracking-tight truncate">
                      {group.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-md bg-slate-200/60 px-1.5 py-0.2 text-[9px] font-bold text-slate-500">
                      {groupLinks.length}
                    </span>
                    <IconChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </div>
                </button>

                {/* Collapsible Content */}
                {isOpen && (
                  <div className="mt-1 space-y-0.5 pt-0.5 border-t border-slate-200/40">
                    {groupLinks.map((link) => {
                      const active = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                      const Icon = link.icon;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => closeMobile?.()}
                          className={`relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all group ${
                            active
                              ? 'bg-gradient-to-l from-blue-50/90 via-blue-50/40 to-transparent text-blue-900 font-bold border-r-3 border-blue-600 shadow-2xs'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:translate-x-0.5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                active
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                              }`}
                            >
                              <Icon size={14} />
                            </span>
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
                )}
              </div>
            );
          })}
        </nav>

        {/* User Session Footer */}
        <div className="border-t border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-bold text-white shadow-2xs">
                {user?.name ? user.name.slice(0, 1) : 'م'}
                <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-900">{user?.name}</div>
                <div className="flex items-center gap-1">
                  <span className="truncate text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                    {user?.roleCode || 'مستخدم'}
                  </span>
                </div>
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

        {/* MiB Technology Corporate Signature */}
        <div className="px-3 pt-2.5 pb-2.5 border-t border-slate-200/60 bg-white">
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-slate-50 via-white to-blue-50/30 px-3 py-2 border border-slate-100 hover:border-slate-200 transition-colors">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400">تطوير وتشغيل</span>
              <span className="text-[9px] text-blue-600 font-bold">v1.0 Pro</span>
            </div>
            <MiBLogo height={26} variant="horizontal" theme="light" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Desktop Sidebar (Animated Rail / Expanded) */}
      <aside
        className={`hidden lg:flex shrink-0 flex-col border-l border-slate-200/80 bg-white shadow-2xs transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[76px]' : 'w-72'
        }`}
      >
        {renderNavContent(undefined, isCollapsed)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden flex" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />
          <div
            className="relative mr-auto flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl animate-entrance"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-3 top-3.5 z-10">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <IconClose size={18} />
              </button>
            </div>
            {renderNavContent(() => setMobileMenuOpen(false), false)}
          </div>
        </div>
      ) : null}

      {/* Main Area with Top Header */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Responsive Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="القائمة الجانبية"
            >
              <IconMenu size={20} />
            </button>

            {/* Desktop collapse toggle button */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
              title={isCollapsed ? 'توسيع القائمة (Ctrl+B)' : 'تصغير القائمة (Ctrl+B)'}
            >
              {isCollapsed ? <IconSidebarExpand size={17} /> : <IconSidebarCollapse size={17} />}
            </button>

            {/* Mobile Brand Mark */}
            <div className="flex lg:hidden items-center gap-2">
              <BayanMark size={28} />
              <span className="text-xs font-black text-slate-900">بيان ERP</span>
            </div>

            {/* Desktop Breadcrumbs */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500">
              <BayanMark size={22} />
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

            <div className="hidden md:flex items-center gap-2.5 border-r border-slate-200 pr-2.5 mr-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                متصل
              </span>
              <div className="h-4 w-px bg-slate-200" />
              <div title="تقنية وتطوير MiB Technology" className="flex items-center">
                <MiBLogo height={24} variant="horizontal" theme="light" />
              </div>
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