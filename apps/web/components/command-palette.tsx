'use client';

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { get, qs, type Customer, type Item, type PriceStatement } from '@/lib/api';
import {
  IconApproval,
  IconArchive,
  IconAudit,
  IconBackup,
  IconBranch,
  IconBrand,
  IconCategory,
  IconCollection,
  IconCustomer,
  IconDashboard,
  IconDevice,
  IconDiagnostics,
  IconGeo,
  IconItem,
  IconNotification,
  IconPlan,
  IconPos,
  IconPrice,
  IconPurchase,
  IconPurchaseOrder,
  IconReport,
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
} from './icons';

interface NavItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: 'صفحات النظام' | 'إجراءات سريعة';
  icon: (props: IconProps) => ReactNode;
}

const STATIC_ITEMS: NavItem[] = [
  // Quick Actions
  { id: 'act-pos', title: 'نقطة بيع سريعة (POS)', subtitle: 'كاشير المعرض والبيع المباشر السريع', href: '/pos', category: 'إجراءات سريعة', icon: IconPos },
  { id: 'act-new-stmt', title: 'إنشاء بيان أسعار جديد', subtitle: 'إصدار فاتورة بيع جديدة', href: '/statements?action=new', category: 'إجراءات سريعة', icon: IconStatement },
  { id: 'act-new-receipt', title: 'سند قبض / تحصيل جديد', subtitle: 'تسجيل دفعة نقدية أو شيك أو محفظة', href: '/collections?action=receipt', category: 'إجراءات سريعة', icon: IconCollection },
  { id: 'act-new-item', title: 'إضافة صنف جديد', subtitle: 'تسجيل صنف حديد أو دهانات ومواصفاته', href: '/items?action=new', category: 'إجراءات سريعة', icon: IconItem },
  { id: 'act-new-po', title: 'أمر شراء جديد', subtitle: 'طلب توريد من الموردين', href: '/purchase-orders?action=new', category: 'إجراءات سريعة', icon: IconPurchaseOrder },
  { id: 'act-new-stocktake', title: 'فتح جلسة جرد مخزني', subtitle: 'بدء جرد كلي أو جزئي للمخازن', href: '/stocktakes?action=new', category: 'إجراءات سريعة', icon: IconStocktake },

  // System Pages
  { id: 'nav-dashboard', title: 'لوحة المعلومات والمؤشرات', subtitle: 'الإحصائيات الحية والتقييم والرسوم البيانية', href: '/dashboard', category: 'صفحات النظام', icon: IconDashboard },
  { id: 'nav-pos', title: 'نقطة البيع السريعة (POS)', subtitle: 'شاشة الكاشير والمبيعات السريعة', href: '/pos', category: 'صفحات النظام', icon: IconPos },
  { id: 'nav-statements', title: 'بيانات الأسعار (المبيعات)', subtitle: 'سجل الفواتير والمبيعات والطباعة', href: '/statements', category: 'صفحات النظام', icon: IconStatement },
  { id: 'nav-quotations', title: 'عروض الأسعار', subtitle: 'عروض الأسعار وتحويلها لبيانات بيع', href: '/quotations', category: 'صفحات النظام', icon: IconStatement },
  { id: 'nav-returns', title: 'مرتجعات المبيعات', subtitle: 'مرتجع حسب العميل أو المندوب', href: '/returns', category: 'صفحات النظام', icon: IconReturn },
  { id: 'nav-purchases', title: 'التوريد والمشتريات', subtitle: 'بيانات التوريد وتكلفة الشحن', href: '/purchases', category: 'صفحات النظام', icon: IconPurchase },
  { id: 'nav-purchase-orders', title: 'أوامر الشراء', subtitle: 'متابعة أوامر الشراء والاستلام', href: '/purchase-orders', category: 'صفحات النظام', icon: IconPurchaseOrder },
  { id: 'nav-supplier-returns', title: 'مرتجعات المشتريات', subtitle: 'إرجاع البضاعة للموردين', href: '/supplier-returns', category: 'صفحات النظام', icon: IconSupplierReturn },
  { id: 'nav-collections', title: 'التحصيل والخزينة', subtitle: 'سندات القبض والشيكات والمحافظ', href: '/collections', category: 'صفحات النظام', icon: IconCollection },
  { id: 'nav-treasury', title: 'الخزينة والإقفال اليومي', subtitle: 'يومية الصندوق ومحاضر تسليم العهدة', href: '/treasury', category: 'صفحات النظام', icon: IconTreasury },
  { id: 'nav-approvals', title: 'الموافقات والاعتمادات', subtitle: 'اعتماد الخصومات والحد الائتماني والمرتجعات', href: '/approvals', category: 'صفحات النظام', icon: IconApproval },
  { id: 'nav-stocktakes', title: 'جلسات الجرد المخزني', subtitle: 'مقارنة الفعلي بالرصيد وتسوية الفروق', href: '/stocktakes', category: 'صفحات النظام', icon: IconStocktake },
  { id: 'nav-transfers', title: 'التحويلات المخزنية', subtitle: 'نقل البضاعة بين المخازن والسيارات', href: '/transfers', category: 'صفحات النظام', icon: IconTransfer },
  { id: 'nav-reports', title: 'التقارير والتقييم', subtitle: '17 تقريراً تفصيلياً وتصدير Excel', href: '/reports', category: 'صفحات النظام', icon: IconReport },
  { id: 'nav-items', title: 'دليل الأصناف', subtitle: 'الحديد والبويات والوحدات المتعددة والأوزان', href: '/items', category: 'صفحات النظام', icon: IconItem },
  { id: 'nav-prices', title: 'الأسعار والتسعير اليومي', subtitle: 'قوائم الأسعار والتسعير الجماعي للحديد', href: '/prices', category: 'صفحات النظام', icon: IconPrice },
  { id: 'nav-special-prices', title: 'الأسعار الخاصة', subtitle: 'عروض مخصصة لعملاء أو فئات معينة', href: '/special-prices', category: 'صفحات النظام', icon: IconSparkles },
  { id: 'nav-customers', title: 'سجل العملاء', subtitle: 'الحدود الائتمانية والمديونيات والمواقع', href: '/customers', category: 'صفحات النظام', icon: IconCustomer },
  { id: 'nav-suppliers', title: 'سجل الموردين', subtitle: 'حسابات الموردين وفواتير الشراء', href: '/suppliers', category: 'صفحات النظام', icon: IconSupplier },
  { id: 'nav-warehouses', title: 'المخازن والمستودعات', subtitle: 'المخازن الرئيسية والحديد والبويات والتالف', href: '/warehouses', category: 'صفحات النظام', icon: IconWarehouse },
  { id: 'nav-categories', title: 'التصنيفات والأنواع', subtitle: 'شجرة تصنيفات المنتجات', href: '/categories', category: 'صفحات النظام', icon: IconCategory },
  { id: 'nav-brands', title: 'العلامات التجارية والماركات', subtitle: 'ماركات البويات ومصانع الحديد', href: '/brands', category: 'صفحات النظام', icon: IconBrand },
  { id: 'nav-branches', title: 'الفروع والمعارض', subtitle: 'فروع ومنافذ بيع الشركة', href: '/branches', category: 'صفحات النظام', icon: IconBranch },
  { id: 'nav-users', title: 'المستخدمون والأدوار', subtitle: 'إدارة الحسابات وحدود الخصم والصلاحيات', href: '/users', category: 'صفحات النظام', icon: IconUser },
  { id: 'nav-devices', title: 'أجهزة المناديب والأمان', subtitle: 'ربط الهواتف والاعتماد والإلغاء عن بعد', href: '/devices', category: 'صفحات النظام', icon: IconDevice },
  { id: 'nav-geo', title: 'تتبع المناديب الجغرافي', subtitle: 'الخريطة المباشرة ومسار اليوم للورديات', href: '/geo', category: 'صفحات النظام', icon: IconGeo },
  { id: 'nav-visit-plans', title: 'خطط الزيارات الميدانية', subtitle: 'جداول زيارات العملاء اليومية', href: '/visit-plans', category: 'صفحات النظام', icon: IconPlan },
  { id: 'nav-targets', title: 'التارجت والعمولات', subtitle: 'مستهدفات البيع وحساب العمولات آلياً', href: '/targets', category: 'صفحات النظام', icon: IconTarget },
  { id: 'nav-archives', title: 'الترحيل والأرشفة', subtitle: 'إغلاق الفترات وتصدير حزم الأرشيف', href: '/archives', category: 'صفحات النظام', icon: IconArchive },
  { id: 'nav-backups', title: 'النسخ الاحتياطي المشفر', subtitle: 'النسخ اليومي واختبار الاسترجاع الآلي', href: '/backups', category: 'صفحات النظام', icon: IconBackup },
  { id: 'nav-notifications', title: 'مركز التنبيهات والإشعارات', subtitle: 'تنبيهات المخزون والائتمان والموافقات', href: '/notifications', category: 'صفحات النظام', icon: IconNotification },
  { id: 'nav-audit-logs', title: 'سجل التدقيق والعمليات', subtitle: 'تتبع من فعل ماذا ومتى بالتفصيل', href: '/audit-logs', category: 'صفحات النظام', icon: IconAudit },
  { id: 'nav-settings', title: 'إعدادات الشركة والضريبة', subtitle: 'بيانات الشركة والضريبة والشعار والميزات', href: '/settings', category: 'صفحات النظام', icon: IconSettings },
  { id: 'nav-diagnostics', title: 'تشخيص وسلامة النظام', subtitle: 'مؤشرات صحة قاعدة البيانات والخوادم والنسخ', href: '/settings/diagnostics', category: 'صفحات النظام', icon: IconDiagnostics },
  { id: 'nav-tools', title: 'أدوات مساعدة', subtitle: 'حاسبة أوزان الحديد وكميات الدهانات', href: '/tools', category: 'صفحات النظام', icon: IconTools },
];

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [statements, setStatements] = useState<PriceStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    setCustomers([]);
    setItems([]);
    setStatements([]);
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0);
    if (!val.trim() || val.trim().length < 2) {
      setCustomers([]);
      setItems([]);
      setStatements([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [cRes, iRes, sRes] = await Promise.allSettled([
          get<{ customers: Customer[] }>(`/customers${qs({ q: query, limit: 5 })}`),
          get<{ items: Item[] }>(`/items${qs({ q: query, limit: 5 })}`),
          get<{ priceStatements: PriceStatement[] }>(`/price-statements${qs({ number: query, limit: 5 })}`),
        ]);

        if (cRes.status === 'fulfilled' && cRes.value?.customers) {
          setCustomers(cRes.value.customers);
        } else {
          setCustomers([]);
        }

        if (iRes.status === 'fulfilled' && iRes.value?.items) {
          setItems(iRes.value.items);
        } else {
          setItems([]);
        }

        if (sRes.status === 'fulfilled' && sRes.value?.priceStatements) {
          setStatements(sRes.value.priceStatements);
        } else {
          setStatements([]);
        }
      } catch {
        /* Ignore error */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredStatic = STATIC_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q);
  });

  type SearchEntry =
    | { type: 'static'; data: NavItem }
    | { type: 'customer'; data: Customer }
    | { type: 'item'; data: Item }
    | { type: 'statement'; data: PriceStatement };

  const allEntries: SearchEntry[] = [
    ...filteredStatic.map((i) => ({ type: 'static' as const, data: i })),
    ...customers.map((c) => ({ type: 'customer' as const, data: c })),
    ...items.map((it) => ({ type: 'item' as const, data: it })),
    ...statements.map((s) => ({ type: 'statement' as const, data: s })),
  ];

  function handleSelect(entry: SearchEntry) {
    if (entry.type === 'static') {
      router.push(entry.data.href);
    } else if (entry.type === 'customer') {
      router.push(`/customers?id=${entry.data.id}`);
    } else if (entry.type === 'item') {
      router.push(`/items?id=${entry.data.id}`);
    } else if (entry.type === 'statement') {
      router.push(`/statements?id=${entry.data.id}`);
    }
    handleClose();
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allEntries.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allEntries.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allEntries[selectedIndex];
      if (current) handleSelect(current);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-xs p-4 pt-16 sm:pt-24 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-entrance"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 bg-slate-50/50">
          <IconSearch size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="ابحث عن شاشة، إجراء، عميل، صنف، أو رقم بيان... (Ctrl + K)"
            className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading ? (
            <span className="text-xs font-bold text-blue-600 animate-pulse">جارِ البحث…</span>
          ) : (
            <kbd className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-400 border border-slate-200 shadow-2xs">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {allEntries.length === 0 ? (
            <div className="py-12 text-center text-xs font-semibold text-slate-400">
              لم يتم العثور على نتائج تطابق «{query}»
            </div>
          ) : (
            <div className="space-y-1">
              {allEntries.map((entry, index) => {
                const isSelected = index === selectedIndex;
                let title = '';
                let subtitle: string | undefined;
                let badge = '';
                let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                let Icon: (props: IconProps) => ReactNode = IconDashboard;

                if (entry.type === 'static') {
                  title = entry.data.title;
                  subtitle = entry.data.subtitle;
                  badge = entry.data.category;
                  Icon = entry.data.icon;
                  badgeColor =
                    entry.data.category === 'إجراءات سريعة'
                      ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                      : 'bg-blue-50 text-blue-800 border-blue-200/80';
                } else if (entry.type === 'customer') {
                  title = entry.data.nameAr;
                  subtitle = `كود: ${entry.data.code} ${entry.data.phone ? `• هاتف: ${entry.data.phone}` : ''}`;
                  badge = 'عميل';
                  Icon = IconCustomer;
                  badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
                } else if (entry.type === 'item') {
                  title = `${entry.data.nameAr} (${entry.data.code})`;
                  subtitle = `تصنيف: ${entry.data.category?.nameAr ?? 'عام'} ${entry.data.lastPurchaseCost ? `• آخر تكلفة: ${entry.data.lastPurchaseCost} ج.م` : ''}`;
                  badge = 'صنف';
                  Icon = IconItem;
                  badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
                } else if (entry.type === 'statement') {
                  title = `بيان أسعار: ${entry.data.number}`;
                  subtitle = `عميل: ${entry.data.customer?.nameAr ?? '—'} • الصافي: ${entry.data.net} ج.م • الحالة: ${entry.data.status}`;
                  badge = 'بيان أسعار';
                  Icon = IconStatement;
                  badgeColor = 'bg-purple-50 text-purple-800 border-purple-200/80';
                }

                return (
                  <div
                    key={`${entry.type}-${index}`}
                    onClick={() => handleSelect(entry)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 border border-blue-200/60 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected ? 'bg-white border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-xs sm:text-sm font-bold truncate">{title}</div>
                        {subtitle ? (
                          <div className="text-[11px] text-slate-400 truncate font-normal">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                        {badge}
                      </span>
                      {isSelected ? (
                        <span className="text-xs font-bold text-blue-600">↵</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-400">
            <span>↑ ↓ للتنقل</span>
            <span>↵ للاختيار</span>
            <span>ESC للإغلاق</span>
          </div>
          <div className="text-[11px] font-bold text-slate-600">نظام بيان ERP</div>
        </div>
      </div>
    </div>
  );
}
