'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { get, qs, type Customer, type Item, type PriceStatement } from '@/lib/api';

interface NavItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: 'صفحات النظام' | 'إجراءات سريعة';
  icon?: string;
}

const STATIC_ITEMS: NavItem[] = [
  // إجراءات سريعة
  { id: 'act-pos', title: 'نقطة بيع سريعة (POS)', subtitle: 'كاشير المعرض والبيع المباشر السريع', href: '/pos', category: 'إجراءات سريعة', icon: '⚡' },
  { id: 'act-new-stmt', title: 'إنشاء بيان أسعار جديد', subtitle: 'إصدار فاتورة بيع جديدة', href: '/statements?action=new', category: 'إجراءات سريعة', icon: '📝' },
  { id: 'act-new-receipt', title: 'سند قبض / تحصيل جديد', subtitle: 'تسجيل دفعة نقدية أو شيك أو محفظة', href: '/collections?action=receipt', category: 'إجراءات سريعة', icon: '💰' },
  { id: 'act-new-item', title: 'إضافة صنف جديد', subtitle: 'تسجيل صنف حديد أو دهانات ومواصفاته', href: '/items?action=new', category: 'إجراءات سريعة', icon: '📦' },
  { id: 'act-new-po', title: 'أمر شراء جديد', subtitle: 'طلب توريد من الموردين', href: '/purchase-orders?action=new', category: 'إجراءات سريعة', icon: '🚚' },
  { id: 'act-new-stocktake', title: 'فتح جلسة جرد مخزني', subtitle: 'بدء جرد كلي أو جزئي للمخازن', href: '/stocktakes?action=new', category: 'إجراءات سريعة', icon: '📋' },

  // صفحات النظام
  { id: 'nav-dashboard', title: 'لوحة المعلومات والمؤشرات', subtitle: 'الإحصائيات الحية والتقييم والرسوم البيانية', href: '/dashboard', category: 'صفحات النظام', icon: '📊' },
  { id: 'nav-pos', title: 'نقطة البيع السريعة (POS)', subtitle: 'شاشة الكاشير والمبيعات السريعة', href: '/pos', category: 'صفحات النظام', icon: '🛒' },
  { id: 'nav-statements', title: 'بيانات الأسعار (المبيعات)', subtitle: 'سجل الفواتير والمبيعات والطباعة', href: '/statements', category: 'صفحات النظام', icon: '🧾' },
  { id: 'nav-quotations', title: 'عروض الأسعار', subtitle: 'عروض الأسعار وتحويلها لبيانات بيع', href: '/quotations', category: 'صفحات النظام', icon: '🏷️' },
  { id: 'nav-returns', title: 'مرتجعات المبيعات', subtitle: 'مرتجع حسب العميل أو المندوب', href: '/returns', category: 'صفحات النظام', icon: '↩️' },
  { id: 'nav-purchases', title: 'التوريد والمشتريات', subtitle: 'بيانات التوريد وتكلفة الشحن', href: '/purchases', category: 'صفحات النظام', icon: '📥' },
  { id: 'nav-purchase-orders', title: 'أوامر الشراء', subtitle: 'متابعة أوامر الشراء والاستلام', href: '/purchase-orders', category: 'صفحات النظام', icon: '📑' },
  { id: 'nav-supplier-returns', title: 'مرتجعات المشتريات', subtitle: 'إرجاع البضاعة للموردين', href: '/supplier-returns', category: 'صفحات النظام', icon: '📤' },
  { id: 'nav-collections', title: 'التحصيل والخزينة', subtitle: 'سندات القبض والشيكات والمحافظ', href: '/collections', category: 'صفحات النظام', icon: '💵' },
  { id: 'nav-treasury', title: 'الخزينة والإقفال اليومي', subtitle: 'يومية الصندوق ومحاضر تسليم العهدة', href: '/treasury', category: 'صفحات النظام', icon: '🏦' },
  { id: 'nav-approvals', title: 'الموافقات والاعتمادات', subtitle: 'اعتماد الخصومات والحد الائتماني والمرتجعات', href: '/approvals', category: 'صفحات النظام', icon: '✅' },
  { id: 'nav-stocktakes', title: 'جلسات الجرد المخزني', subtitle: 'مقارنة الفعلي بالرصيد وتسوية الفروق', href: '/stocktakes', category: 'صفحات النظام', icon: '🔎' },
  { id: 'nav-transfers', title: 'التحويلات المخزنية', subtitle: 'نقل البضاعة بين المخازن والسيارات', href: '/transfers', category: 'صفحات النظام', icon: '🔄' },
  { id: 'nav-reports', title: 'التقارير والتقييم', subtitle: '17 تقريراً تفصيلياً وتصدير Excel', href: '/reports', category: 'صفحات النظام', icon: '📈' },
  { id: 'nav-items', title: 'دليل الأصناف', subtitle: 'الحديد والبويات والوحدات المتعددة والأوزان', href: '/items', category: 'صفحات النظام', icon: '🧱' },
  { id: 'nav-prices', title: 'الأسعار والتسعير اليومي', subtitle: 'قوائم الأسعار والتسعير الجماعي للحديد', href: '/prices', category: 'صفحات النظام', icon: '💲' },
  { id: 'nav-special-prices', title: 'الأسعار الخاصة', subtitle: 'عروض مخصصة لعملاء أو فئات معينة', href: '/special-prices', category: 'صفحات النظام', icon: '✨' },
  { id: 'nav-customers', title: 'سجل العملاء', subtitle: 'الحدود الائتمانية والمديونيات والمواقع', href: '/customers', category: 'صفحات النظام', icon: '👥' },
  { id: 'nav-suppliers', title: 'سجل الموردين', subtitle: 'حسابات الموردين وفواتير الشراء', href: '/suppliers', category: 'صفحات النظام', icon: '🏭' },
  { id: 'nav-warehouses', title: 'المخازن والمستودعات', subtitle: 'المخازن الرئيسية والحديد والبويات والتالف', href: '/warehouses', category: 'صفحات النظام', icon: '🏬' },
  { id: 'nav-categories', title: 'التصنيفات والأنواع', subtitle: 'شجرة تصنيفات المنتجات', href: '/categories', category: 'صفحات النظام', icon: '📂' },
  { id: 'nav-brands', title: 'العلامات التجارية والماركات', subtitle: 'ماركات البويات ومصانع الحديد', href: '/brands', category: 'صفحات النظام', icon: '🏷️' },
  { id: 'nav-branches', title: 'الفروع والمعارض', subtitle: 'فروع ومنافذ بيع الشركة', href: '/branches', category: 'صفحات النظام', icon: '🏢' },
  { id: 'nav-users', title: 'المستخدمون والأدوار', subtitle: 'إدارة الحسابات وحدود الخصم والصلاحيات', href: '/users', category: 'صفحات النظام', icon: '👤' },
  { id: 'nav-devices', title: 'أجهزة المناديب والأمان', subtitle: 'ربط الهواتف والاعتماد والإلغاء عن بعد', href: '/devices', category: 'صفحات النظام', icon: '📱' },
  { id: 'nav-geo', title: 'تتبع المناديب الجغرافي', subtitle: 'الخريطة المباشرة ومسار اليوم للورديات', href: '/geo', category: 'صفحات النظام', icon: '🗺️' },
  { id: 'nav-visit-plans', title: 'خطط الزيارات الميدانية', subtitle: 'جداول زيارات العملاء اليومية', href: '/visit-plans', category: 'صفحات النظام', icon: '📌' },
  { id: 'nav-targets', title: 'التارجت والعمولات', subtitle: 'مستهدفات البيع وحساب العمولات آلياً', href: '/targets', category: 'صفحات النظام', icon: '🎯' },
  { id: 'nav-archives', title: 'الترحيل والأرشفة', subtitle: 'إغلاق الفترات وتصدير حزم الأرشيف', href: '/archives', category: 'صفحات النظام', icon: '🗄️' },
  { id: 'nav-backups', title: 'النسخ الاحتياطي المشفر', subtitle: 'النسخ اليومي واختبار الاسترجاع الآلي', href: '/backups', category: 'صفحات النظام', icon: '🛡️' },
  { id: 'nav-notifications', title: 'مركز التنبيهات والإشعارات', subtitle: 'تنبيهات المخزون والائتمان والموافقات', href: '/notifications', category: 'صفحات النظام', icon: '🔔' },
  { id: 'nav-audit-logs', title: 'سجل التدقيق والعمليات', subtitle: 'تتبع من فعل ماذا ومتى بالتفصيل', href: '/audit-logs', category: 'صفحات النظام', icon: '📜' },
  { id: 'nav-settings', title: 'إعدادات الشركة والضريبة', subtitle: 'بيانات الشركة والضريبة والشعار والميزات', href: '/settings', category: 'صفحات النظام', icon: '⚙️' },
  { id: 'nav-diagnostics', title: 'تشخيص وسلامة النظام', subtitle: 'مؤشرات صحة قاعدة البيانات والخوادم والنسخ', href: '/settings/diagnostics', category: 'صفحات النظام', icon: '🩺' },
  { id: 'nav-tools', title: 'أدوات مساعدة', subtitle: 'حاسبة أوزان الحديد وكميات الدهانات', href: '/tools', category: 'صفحات النظام', icon: '🧮' },
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
    onClose();
  }, [onClose]);

  // التركيز التلقائي عند الفتح
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // إغلاق بمفتاح Escape
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

  // البحث التفاعلي في الـ API مع debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [cRes, iRes, sRes] = await Promise.allSettled([
          get<{ customers: Customer[] }>(`/customers${qs({ q: trimmed, limit: 5 })}`),
          get<{ items: Item[] }>(`/items${qs({ q: trimmed, limit: 5 })}`),
          get<{ statements: PriceStatement[] }>(`/price-statements${qs({ q: trimmed, limit: 5 })}`),
        ]);

        if (cancelled) return;
        if (cRes.status === 'fulfilled') setCustomers(cRes.value.customers ?? []);
        if (iRes.status === 'fulfilled') setItems(iRes.value.items ?? []);
        if (sRes.status === 'fulfilled') setStatements(sRes.value.statements ?? []);
      } catch {
        // تجاهل أخطاء الشبكة أثناء الكتابة السريعة
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // تصفية العناصر الثابتة
  const filteredStatic = query.trim()
    ? STATIC_ITEMS.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : STATIC_ITEMS;

  const hasLiveQuery = query.trim().length >= 2;
  const activeCustomers = hasLiveQuery ? customers : [];
  const activeItems = hasLiveQuery ? items : [];
  const activeStatements = hasLiveQuery ? statements : [];

  // دمج كل النتائج في قائمة مسطحة للتنقل بالأسهم
  type ResultEntry =
    | { type: 'static'; data: NavItem }
    | { type: 'customer'; data: Customer }
    | { type: 'item'; data: Item }
    | { type: 'statement'; data: PriceStatement };

  const allEntries: ResultEntry[] = [
    ...filteredStatic.map((s) => ({ type: 'static' as const, data: s })),
    ...activeCustomers.map((c) => ({ type: 'customer' as const, data: c })),
    ...activeItems.map((i) => ({ type: 'item' as const, data: i })),
    ...activeStatements.map((st) => ({ type: 'statement' as const, data: st })),
  ];

  // اختيار عنصر
  const handleSelect = useCallback((entry: ResultEntry) => {
    onClose();
    if (entry.type === 'static') {
      router.push(entry.data.href);
    } else if (entry.type === 'customer') {
      router.push(`/customers?id=${entry.data.id}`);
    } else if (entry.type === 'item') {
      router.push(`/items?id=${entry.data.id}`);
    } else if (entry.type === 'statement') {
      router.push(`/statements?id=${entry.data.id}`);
    }
  }, [onClose, router]);

  // التنقل بالأسهم ومفتاح Enter
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allEntries.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allEntries.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allEntries[selectedIndex];
      if (current) handleSelect(current);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 pt-16 sm:pt-24 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-zinc-900 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط الإدخال */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3.5 dark:border-zinc-800">
          <span className="text-xl text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="ابحث عن شاشة، إجراء، عميل، صنف، أو رقم بيان... (Ctrl + K)"
            className="flex-1 bg-transparent text-base font-semibold text-gray-900 outline-none placeholder:text-gray-400 dark:text-zinc-100"
          />
          {loading ? (
            <span className="text-xs text-blue-600 animate-pulse">جارِ البحث…</span>
          ) : (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-400 dark:bg-zinc-800">
              ESC للإغلاق
            </span>
          )}
        </div>

        {/* نتائج البحث */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-gray-100 dark:divide-zinc-800">
          {allEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              لم يتم العثور على نتائج تطابق «{query}»
            </div>
          ) : (
            <div className="space-y-1">
              {allEntries.map((entry, index) => {
                const isSelected = index === selectedIndex;
                let title = '';
                let subtitle: string | undefined;
                let badge: string = '';
                let badgeColor = 'bg-gray-100 text-gray-700';
                let icon = '🔹';

                if (entry.type === 'static') {
                  title = entry.data.title;
                  subtitle = entry.data.subtitle;
                  badge = entry.data.category;
                  icon = entry.data.icon ?? '🔹';
                  badgeColor = entry.data.category === 'إجراءات سريعة' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';
                } else if (entry.type === 'customer') {
                  title = entry.data.nameAr;
                  subtitle = `كود: ${entry.data.code} ${entry.data.phone ? `• هاتف: ${entry.data.phone}` : ''}`;
                  badge = 'عميل';
                  icon = '👤';
                  badgeColor = 'bg-emerald-100 text-emerald-800';
                } else if (entry.type === 'item') {
                  title = `${entry.data.nameAr} (${entry.data.code})`;
                  subtitle = `تصنيف: ${entry.data.category?.nameAr ?? 'عام'} ${entry.data.lastPurchaseCost ? `• آخر تكلفة: ${entry.data.lastPurchaseCost} ج.م` : ''}`;
                  badge = 'صنف';
                  icon = '🧱';
                  badgeColor = 'bg-indigo-100 text-indigo-800';
                } else if (entry.type === 'statement') {
                  title = `بيان أسعار: ${entry.data.number}`;
                  subtitle = `عميل: ${entry.data.customer?.nameAr ?? '—'} • الصافي: ${entry.data.net} ج.م • الحالة: ${entry.data.status}`;
                  badge = 'بيان أسعار';
                  icon = '🧾';
                  badgeColor = 'bg-purple-100 text-purple-800';
                }

                return (
                  <div
                    key={`${entry.type}-${index}`}
                    onClick={() => handleSelect(entry)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{icon}</span>
                      <div className="truncate">
                        <div className="text-sm font-bold truncate">{title}</div>
                        {subtitle ? (
                          <div className="text-xs text-gray-500 truncate dark:text-gray-400">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeColor}`}>
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

        {/* شريط المساعدة السفلي */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-4">
            <span>↑ ↓ للتنقل</span>
            <span>↵ للاختيار</span>
            <span>ESC للإغلاق</span>
          </div>
          <div className="font-semibold text-gray-600 dark:text-gray-400">نظام بيان ERP</div>
        </div>
      </div>
    </div>
  );
}
