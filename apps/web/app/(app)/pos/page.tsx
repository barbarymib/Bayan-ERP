'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  can,
  get,
  post,
  type CompanySettings,
  type Customer,
  type CustomersPage,
  type Item,
  type ItemsPage,
  type PriceStatement,
  type Warehouse,
  type WarehousesPage,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorBox, Modal, formatMoney } from '@/components/ui';

interface CartLine {
  rowId: string;
  itemId: number;
  itemCode: string;
  nameAr: string;
  unitCode: string;
  unitName: string;
  availableUnits: { code: string; nameAr: string }[];
  qty: number;
  unitPrice: number;
  lineDiscount: number;
}

interface HeldTicket {
  id: string;
  timestamp: string;
  customerName: string;
  lines: CartLine[];
  total: number;
}

function playScanBeep() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    /* audio not supported or blocked */
  }
}

export default function PosTerminalPage() {
  const { user } = useAuth();
  const canCreate = can(user, 'statement.create');

  // Master data
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [company, setCompany] = useState<CompanySettings['company'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart & Active Sale
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'WALLET' | 'CARD' | 'CREDIT'>('CASH');
  const [tenderAmount, setTenderAmount] = useState<number>(0);

  // UI state & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PriceStatement | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [clockTime, setClockTime] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Live Digital Clock
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setClockTime(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial master data
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [itemsRes, custRes, whRes, compRes] = await Promise.all([
          get<ItemsPage>('/items?limit=150'),
          get<CustomersPage>('/customers?limit=100'),
          get<WarehousesPage>('/warehouses'),
          get<CompanySettings>('/company').catch(() => null),
        ]);

        if (cancelled) return;
        setItems(itemsRes.items);
        setCustomers(custRes.customers);
        setWarehouses(whRes.warehouses);

        if (compRes?.company) {
          setCompany(compRes.company);
          setTaxPercent(compRes.company.taxPercent ?? 0);
        }

        // Set default customer (prefer cash customer or first available)
        const cashCust =
          custRes.customers.find(
            (c) =>
              c.nameAr.includes('نقدي') ||
              c.nameAr.includes('كاش') ||
              c.nameAr.includes('صالة') ||
              c.code.toLowerCase().includes('cash'),
          ) ?? custRes.customers[0];
        if (cashCust) setSelectedCustomerId(cashCust.id);

        // Set default warehouse
        if (whRes.warehouses.length > 0) {
          setSelectedWarehouseId(whRes.warehouses[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'فشل تحميل بيانات نقطة البيع');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep barcode input focused for high-speed counter operation
  const focusBarcode = useCallback(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!loading && !receiptModal && !showHeldModal) {
      focusBarcode();
    }
  }, [loading, receiptModal, showHeldModal, focusBarcode]);

  // Fast notification toast
  function showFlash(msg: string) {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(null), 2500);
  }

  // Add Item to Cart
  const addItemToCart = useCallback(
    (item: Item, qtyToAdd = 1) => {
      playScanBeep();
      setCart((prev) => {
        const existingIdx = prev.findIndex((line) => line.itemId === item.id);
        const basePrice = item.minSalePrice ? Number(item.minSalePrice) : 0;

        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx],
            qty: next[existingIdx].qty + qtyToAdd,
          };
          return next;
        }

        const availableUnits = [
          { code: item.baseUnit.code, nameAr: item.baseUnit.nameAr ?? item.baseUnit.code },
          ...item.itemUnits.map((iu) => ({
            code: iu.unit.code,
            nameAr: iu.unit.nameAr ?? iu.unit.code,
          })),
        ];

        const newLine: CartLine = {
          rowId: `${item.id}-${Date.now()}-${Math.random()}`,
          itemId: item.id,
          itemCode: item.code,
          nameAr: item.nameAr,
          unitCode: item.baseUnit.code,
          unitName: item.baseUnit.nameAr ?? item.baseUnit.code,
          availableUnits,
          qty: qtyToAdd,
          unitPrice: basePrice,
          lineDiscount: 0,
        };

        return [newLine, ...prev];
      });

      showFlash(`+ ${item.nameAr}`);
    },
    [],
  );

  // Barcode / Scanner submission
  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // Search exact barcode in item or item units, or match exact code
    const matched = items.find((it) => {
      if (it.barcode && it.barcode.toLowerCase() === query.toLowerCase()) return true;
      if (it.code.toLowerCase() === query.toLowerCase()) return true;
      const unitMatch = it.itemUnits?.some(
        (iu) => iu.barcode && iu.barcode.toLowerCase() === query.toLowerCase(),
      );
      return unitMatch;
    });

    if (matched) {
      addItemToCart(matched, 1);
      setBarcodeInput('');
    } else {
      // Partial name or code search fallback
      const fallback = items.find(
        (it) =>
          it.code.toLowerCase().includes(query.toLowerCase()) ||
          it.nameAr.toLowerCase().includes(query.toLowerCase()),
      );
      if (fallback) {
        addItemToCart(fallback, 1);
        setBarcodeInput('');
      } else {
        showFlash(`⚠️ الصنف "${query}" غير موجود`);
      }
    }
  }

  // Update line details
  function updateLine(rowId: string, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((line) => (line.rowId === rowId ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(rowId: string) {
    setCart((prev) => prev.filter((line) => line.rowId !== rowId));
  }

  // Totals calculations
  const subtotal = cart.reduce((sum, line) => {
    const lineGross = line.qty * line.unitPrice;
    return sum + Math.max(0, lineGross - line.lineDiscount);
  }, 0);

  const invoiceDiscountAmount =
    discountType === 'percent'
      ? (subtotal * Math.min(100, Math.max(0, discountValue))) / 100
      : Math.min(subtotal, Math.max(0, discountValue));

  const afterDiscount = Math.max(0, subtotal - invoiceDiscountAmount);
  const taxAmount = (afterDiscount * Math.max(0, taxPercent)) / 100;
  const grandTotal = Math.round((afterDiscount + taxAmount) * 100) / 100;

  // Auto-fill exact tender if method is Cash and tender is 0
  const changeDue = Math.max(0, tenderAmount - grandTotal);
  const remainingDue = Math.max(0, grandTotal - tenderAmount);

  // Quick cash buttons
  function setTenderExact() {
    setTenderAmount(grandTotal);
    focusBarcode();
  }

  function addTender(denom: number) {
    setTenderAmount((prev) => {
      const base = prev >= grandTotal ? prev : grandTotal;
      return base + denom;
    });
    focusBarcode();
  }

  // Hold current ticket
  function holdCurrentTicket() {
    if (cart.length === 0) return;
    const cust = customers.find((c) => c.id === selectedCustomerId);
    const newHold: HeldTicket = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString('ar-EG'),
      customerName: cust?.nameAr ?? 'عميل نقدي',
      lines: [...cart],
      total: grandTotal,
    };
    setHeldTickets((prev) => [newHold, ...prev]);
    setCart([]);
    setTenderAmount(0);
    showFlash('تم تعليق الفاتورة بنجاح');
    focusBarcode();
  }

  // Restore held ticket
  function restoreHeldTicket(ticket: HeldTicket) {
    setCart(ticket.lines);
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    setShowHeldModal(false);
    showFlash('تم استرجاع الفاتورة المعلقة');
    focusBarcode();
  }

  // Checkout and submit
  async function handleCheckout() {
    if (cart.length === 0) {
      showFlash('السلة فارغة، برجاء مسح أو اختيار أصناف أولاً');
      return;
    }
    if (!selectedCustomerId) {
      showFlash('يرجى تحديد العميل');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = {
        customerId: selectedCustomerId,
        warehouseId: selectedWarehouseId ?? undefined,
        paymentTerm: paymentMethod === 'CREDIT' ? 'CREDIT' : 'CASH',
        date: new Date().toISOString().slice(0, 10),
        lines: cart.map((l) => ({
          itemCode: l.itemCode,
          unitCode: l.unitCode,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discount: l.lineDiscount > 0 ? { type: 'amount' as const, value: l.lineDiscount } : undefined,
        })),
        discount:
          discountValue > 0
            ? {
                type: discountType,
                value: discountValue,
              }
            : undefined,
        shipping: 0,
        paid: paymentMethod === 'CREDIT' ? 0 : tenderAmount > 0 ? tenderAmount : grandTotal,
        taxPercent,
        notes: `نقطة بيع سريعة (POS) • الكاشير: ${user?.name ?? 'معرض'} • الدفع: ${paymentMethod}`,
      };

      const statement = await post<PriceStatement>('/price-statements', payload);
      setReceiptModal(statement);
      setCart([]);
      setDiscountValue(0);
      setTenderAmount(0);
      showFlash(`✅ تم إصدار الفاتورة رقم ${statement.number}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إتمام عملية البيع');
    } finally {
      setBusy(false);
    }
  }

  // Keyboard Shortcuts (F2: barcode, F4: pay, F8: clear/hold, Esc: clear)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        focusBarcode();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (!busy && cart.length > 0) {
          handleCheckout();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && confirm('هل تريد تفريغ السلة الحالية والبدء من جديد؟')) {
          setCart([]);
          setTenderAmount(0);
          focusBarcode();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Extract unique categories for filtering
  const categoryList = Array.from(
    new Set(
      items
        .map((it) => it.category?.nameAr ?? it.category?.code)
        .filter((c): c is string => Boolean(c)),
    ),
  );

  const filteredItems = items.filter((it) => {
    const matchesCat =
      activeCategory === 'ALL' ||
      it.category?.nameAr === activeCategory ||
      it.category?.code === activeCategory;
    const matchesSearch =
      !searchQuery ||
      it.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.barcode && it.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] -m-4 sm:-m-6 bg-gray-100 overflow-hidden select-none">
      {/* 1. POS Top Bar */}
      <header className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between shadow-md shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-base font-black tracking-wide text-white">نقطة البيع السريعة (POS)</span>
          </div>
          <span className="text-slate-500">|</span>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400">الكاشير:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
              {user?.name ?? 'كاشير المعرض'}
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400">المخزن:</span>
            <select
              value={selectedWarehouseId ?? ''}
              onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
              className="bg-slate-800 text-white text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nameAr} ({w.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Shortcuts & Clock */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-emerald-400">
              F2: باركود
            </span>
            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-blue-400">
              F4: دفع
            </span>
            <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono text-amber-400">
              F8: تفريغ
            </span>
          </div>

          {heldTickets.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>⏸️ المعلقة ({heldTickets.length})</span>
            </button>
          )}

          <div className="font-mono text-sm font-bold text-emerald-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            {clockTime || '00:00:00'}
          </div>

          <Link
            href="/dashboard"
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
          >
            خروج ✕
          </Link>
        </div>
      </header>

      {/* Flash message banner */}
      {flashMessage && (
        <div className="bg-blue-600 text-white text-center py-1.5 text-sm font-semibold tracking-wide shadow transition-all animate-bounce">
          {flashMessage}
        </div>
      )}

      {/* Main Workspace (Catalog on Left, Cart & Payment on Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section: Catalog & Fast Barcode Search */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden border-e border-gray-200">
          {/* Barcode scanner input */}
          <form onSubmit={handleBarcodeSubmit} className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </span>
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="امسح الباركود أو اكتب كود الصنف واضغط Enter (F2) …"
                className="w-full ps-11 pe-4 py-2.5 rounded-xl border-2 border-blue-500 bg-white text-gray-900 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm text-sm"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow transition-colors"
            >
              إضافة
            </button>
          </form>

          {/* Categories Pill Bar & Quick Search Filter */}
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <div className="flex-1 overflow-x-auto flex items-center gap-1.5 pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                  activeCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                الكل ({items.length})
              </button>
              {categoryList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="w-48 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="تصفية بالاسم…"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                جارِ تحميل دليل الأصناف…
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <span className="text-3xl mb-1">📦</span>
                <span>لا توجد أصناف تطابق البحث</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredItems.map((item) => {
                  const price = Number(item.minSalePrice) || 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItemToCart(item, 1)}
                      className="flex flex-col justify-between text-start p-3 rounded-xl bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all active:scale-[0.98] group relative"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span className="font-mono text-gray-400">{item.code}</span>
                          {item.category?.nameAr && (
                            <span className="truncate max-w-[80px] text-gray-400">
                              {item.category.nameAr}
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {item.nameAr}
                        </h5>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600">
                          {price > 0 ? formatMoney(price) : 'حسب السعر'}
                        </span>
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                          {item.baseUnit.nameAr ?? item.baseUnit.code}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Active Ticket / Cart & Payment Terminal */}
        <div className="w-[420px] lg:w-[460px] bg-white flex flex-col shadow-xl shrink-0 z-10">
          {/* Ticket Header & Customer Selector */}
          <div className="p-3.5 border-b border-gray-200 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">فاتورة المبيعات</span>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button
                    onClick={holdCurrentTicket}
                    className="text-xs font-semibold text-amber-700 hover:bg-amber-100 px-2 py-1 rounded transition-colors"
                    title="تعليق الفاتورة الحالية والبدء بفاتورة أخرى"
                  >
                    ⏸️ تعليق
                  </button>
                )}
                {cart.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('تفريغ الفاتورة؟')) setCart([]);
                    }}
                    className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                  >
                    مسح 🗑️
                  </button>
                )}
              </div>
            </div>

            {/* Customer Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">العميل:</span>
              <select
                value={selectedCustomerId ?? ''}
                onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                className="w-full text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            {selectedCustomer && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
                <span>الهاتف: {selectedCustomer.phone ?? '—'}</span>
                <span>الحد الائتماني: {formatMoney(Number(selectedCustomer.creditLimit))}</span>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <span className="text-4xl mb-2">🛒</span>
                <span className="text-sm font-semibold">الفاتورة فارغة</span>
                <span className="text-xs text-gray-400 mt-1">
                  امسح الباركود أو اختر أصنافاً من القائمة للإضافة
                </span>
              </div>
            ) : (
              cart.map((line, idx) => {
                const lineTotal = line.qty * line.unitPrice - line.lineDiscount;
                return (
                  <div key={line.rowId} className="p-2 hover:bg-blue-50/40 rounded-lg transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 rounded">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-gray-900 line-clamp-1">{line.nameAr}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{line.itemCode}</span>
                      </div>
                      <button
                        onClick={() => removeLine(line.rowId)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors text-xs"
                        title="حذف الصنف"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      {/* Qty controls */}
                      <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                        <button
                          onClick={() => {
                            if (line.qty <= 1) removeLine(line.rowId);
                            else updateLine(line.rowId, { qty: line.qty - 1 });
                          }}
                          className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 font-bold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={line.qty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateLine(line.rowId, { qty: isNaN(val) ? 0 : val });
                          }}
                          className="w-12 text-center text-xs font-bold text-gray-900 focus:outline-none py-0.5"
                          min="0.01"
                          step="any"
                        />
                        <button
                          onClick={() => updateLine(line.rowId, { qty: line.qty + 1 })}
                          className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Unit Selector */}
                      {line.availableUnits.length > 1 ? (
                        <select
                          value={line.unitCode}
                          onChange={(e) => updateLine(line.rowId, { unitCode: e.target.value })}
                          className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5"
                        >
                          {line.availableUnits.map((u) => (
                            <option key={u.code} value={u.code}>
                              {u.nameAr}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] text-gray-500">{line.unitName}</span>
                      )}

                      {/* Price input */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">×</span>
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.rowId, { unitPrice: parseFloat(e.target.value) || 0 })}
                          className="w-16 text-end text-xs font-bold text-gray-800 border-b border-gray-200 focus:outline-none focus:border-blue-500 px-1"
                          step="any"
                        />
                      </div>

                      {/* Line Total */}
                      <span className="font-bold text-gray-900 min-w-[70px] text-end">
                        {formatMoney(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Ticket Calculations & Fast Cash Tender */}
          <div className="p-3.5 bg-gray-50 border-t border-gray-200 space-y-2 text-xs">
            {/* Subtotal, discount & tax */}
            <div className="flex justify-between text-gray-600">
              <span>المجموع الفرعي:</span>
              <span className="font-semibold text-gray-800">{formatMoney(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-gray-600">
              <div className="flex items-center gap-1.5">
                <span>خصم الفاتورة:</span>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percent' | 'amount')}
                  className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5"
                >
                  <option value="percent">%</option>
                  <option value="amount">مبلغ</option>
                </select>
                <input
                  type="number"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-14 text-center bg-white border border-gray-200 rounded px-1 py-0.5 text-xs font-bold"
                  min="0"
                />
              </div>
              <span className="text-red-600 font-semibold">- {formatMoney(invoiceDiscountAmount)}</span>
            </div>

            {taxPercent > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>ضريبة القيمة المضافة ({taxPercent}%):</span>
                <span className="font-semibold text-gray-800">{formatMoney(taxAmount)}</span>
              </div>
            )}

            {/* GRAND TOTAL in large bold */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-300">
              <span className="text-base font-black text-gray-900">الإجمالي النهائي:</span>
              <span className="text-2xl font-black text-blue-700">{formatMoney(grandTotal)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1 pt-1.5">
              {[
                { id: 'CASH', label: '💵 نقد' },
                { id: 'WALLET', label: '📱 إنستاباي' },
                { id: 'CARD', label: '💳 فيزا' },
                { id: 'CREDIT', label: '📋 آجل' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setPaymentMethod(m.id as 'CASH' | 'WALLET' | 'CARD' | 'CREDIT');
                    if (m.id === 'CASH' && tenderAmount === 0) setTenderAmount(grandTotal);
                  }}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    paymentMethod === m.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Cash Tender & Change Due */}
            {paymentMethod === 'CASH' && (
              <div className="bg-white p-2 rounded-xl border border-gray-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">المبلغ المدفوع:</span>
                  <input
                    type="number"
                    value={tenderAmount || ''}
                    onChange={(e) => setTenderAmount(parseFloat(e.target.value) || 0)}
                    placeholder={String(grandTotal)}
                    className="w-24 text-end font-bold text-sm text-gray-900 border border-gray-300 rounded px-2 py-0.5 focus:border-blue-500 focus:outline-none"
                    step="any"
                  />
                </div>

                {/* Quick denomination pills */}
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={setTenderExact}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-700"
                  >
                    بالضبط
                  </button>
                  {[20, 50, 100, 200].map((denom) => (
                    <button
                      key={denom}
                      onClick={() => addTender(denom)}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-700"
                    >
                      +{denom}
                    </button>
                  ))}
                </div>

                {/* Change amount */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                  <span className="text-gray-500">الباقي للعميل:</span>
                  <span className={`font-black text-sm ${changeDue > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {formatMoney(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {paymentMethod === 'CREDIT' && (
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-200 text-xs text-amber-800 flex justify-between">
                <span>المتبقي ذمة على العميل:</span>
                <span className="font-bold">{formatMoney(remainingDue)}</span>
              </div>
            )}

            {error && (
              <div className="my-1 text-xs">
                <ErrorBox message={error} />
              </div>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={busy || cart.length === 0 || !canCreate}
              title={!canCreate ? 'ليس لديك صلاحية إنشاء فواتير (statement.create)' : undefined}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-black py-3 rounded-xl text-base shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {busy ? (
                <span>جارِ إتمام الفاتورة…</span>
              ) : (
                <>
                  <span>إتمام البيع وطباعة الإيصال (F4)</span>
                  <span className="text-emerald-200 text-sm">↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Held Tickets Modal */}
      {showHeldModal && (
        <Modal title="الفواتير المعلقة" onClose={() => setShowHeldModal(false)}>
          <div className="space-y-3">
            {heldTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{ticket.customerName}</span>
                    <span className="text-xs text-gray-500 font-mono">{ticket.timestamp}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {ticket.lines.length} صنف • الإجمالي: <span className="font-bold">{formatMoney(ticket.total)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={() => restoreHeldTicket(ticket)}>
                    استرجاع ↵
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setHeldTickets((prev) => prev.filter((t) => t.id !== ticket.id))}
                  >
                    حذف
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Printable 80mm Receipt Modal */}
      {receiptModal && (
        <Modal title="إيصال استلام المبيعات (80mm)" onClose={() => setReceiptModal(null)}>
          <div className="flex flex-col items-center">
            {/* 80mm Receipt Preview Container */}
            <div
              id="pos-thermal-receipt"
              className="w-72 bg-white text-black p-4 font-mono text-xs border border-gray-300 rounded shadow-sm space-y-3 leading-relaxed"
            >
              {/* Header */}
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-400">
                <h3 className="text-base font-black tracking-wider">{company?.nameAr ?? 'بيان ERP'}</h3>
                <p className="text-[10px] text-gray-600">فرع المعرض ونقطة البيع</p>
                {company?.phone && <p className="text-[10px] text-gray-600">هاتف: {company.phone}</p>}
                <div className="pt-1 text-[11px] font-bold">إيصال مبيعات نقدية</div>
              </div>

              {/* Meta */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-gray-400 pb-2">
                <div className="flex justify-between">
                  <span>رقم الإيصال:</span>
                  <span className="font-bold">{receiptModal.number}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span>{new Date().toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex justify-between">
                  <span>الكاشير:</span>
                  <span>{user?.name ?? 'كاشير'}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span>{receiptModal.customer.nameAr}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-gray-400 pb-2">
                <div className="flex justify-between font-bold text-[10px] pb-1 border-b border-gray-200">
                  <span>الصنف</span>
                  <span>الكمية × السعر</span>
                  <span>الإجمالي</span>
                </div>
                <div className="divide-y divide-gray-100 text-[10px]">
                  {receiptModal.lines?.map((line, i) => (
                    <div key={i} className="py-1">
                      <div className="font-bold">{line.item?.nameAr ?? line.item?.code ?? '—'}</div>
                      <div className="flex justify-between text-gray-600">
                        <span>
                          {Number(line.qty)} {line.unit?.nameAr ?? ''} × {formatMoney(Number(line.unitPrice))}
                        </span>
                        <span className="font-bold text-black">{formatMoney(Number(line.netLine ?? 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-gray-400 pb-2">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{formatMoney(Number(receiptModal.subtotal))}</span>
                </div>
                {Number(receiptModal.discountAmount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم:</span>
                    <span>- {formatMoney(Number(receiptModal.discountAmount))}</span>
                  </div>
                )}
                {Number(receiptModal.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>ضريبة القيمة المضافة:</span>
                    <span>{formatMoney(Number(receiptModal.taxAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200">
                  <span>الصافي المطلوب:</span>
                  <span>{formatMoney(Number(receiptModal.net))}</span>
                </div>
                <div className="flex justify-between text-[10px] pt-1">
                  <span>المدفوع:</span>
                  <span>{formatMoney(Number(receiptModal.paid ?? receiptModal.net))}</span>
                </div>
              </div>

              {/* QR & Footer */}
              <div className="text-center pt-2 space-y-1">
                <div className="inline-block p-1 border border-gray-300 rounded bg-gray-50">
                  <div className="w-16 h-16 flex items-center justify-center text-[10px] text-gray-400 bg-white border border-gray-200 font-mono">
                    [ QR Code ]
                  </div>
                </div>
                <p className="text-[9px] text-gray-500">شكراً لزيارتكم • بضاعة مباعة تستبدل وفق الشروط</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ طباعة الإيصال (Ctrl+P)
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setReceiptModal(null);
                  focusBarcode();
                }}
              >
                عملية بيع جديدة (F8)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
