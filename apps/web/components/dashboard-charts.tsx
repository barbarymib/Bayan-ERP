'use client';

import { useState } from 'react';
import { formatMoney } from '@/components/ui';

export interface TrendPoint {
  period: string; // e.g. "2026-10-18"
  net: number;
  count: number;
}

export interface CategoryShare {
  name: string;
  net: number;
  percentage?: number;
}

/**
 * Interactive SVG Sales Trend Area Chart
 */
export function SalesTrendChart({
  points,
  title = 'اتجاه المبيعات اليومية',
}: {
  points: TrendPoint[];
  title?: string;
}) {
  const [hovered, setHovered] = useState<TrendPoint | null>(null);

  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-400">
        لا توجد بيانات حركة مبيعات كافية للرسم البياني
      </div>
    );
  }

  // Sort points by date
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const maxNet = Math.max(...sorted.map((p) => p.net), 100);

  // SVG dimensions
  const width = 640;
  const height = 220;
  const padX = 40;
  const padY = 28;

  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  // Point coordinates
  const coords = sorted.map((p, idx) => {
    const x = padX + (sorted.length > 1 ? (idx / (sorted.length - 1)) * chartW : chartW / 2);
    const y = height - padY - (p.net / maxNet) * chartH;
    return { x, y, point: p };
  });

  // Line and Area paths
  const pathD = coords.reduce(
    (acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
    '',
  );
  const areaD = `${pathD} L ${coords[coords.length - 1]?.x.toFixed(1)} ${height - padY} L ${coords[0]?.x.toFixed(1)} ${height - padY} Z`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400">حركة إجمالي الصافي عبر فترات التسجيل</p>
        </div>
        {hovered ? (
          <div className="rounded-xl bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200/80 animate-entrance">
            {hovered.period}: <span className="font-black text-blue-800">{formatMoney(hovered.net)}</span>{' '}
            <span className="text-blue-500 font-medium">({hovered.count} بيان)</span>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-400">
            الذروة: <span className="text-slate-700">{formatMoney(maxNet)}</span>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
            <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((pct, i) => {
            const y = height - padY - pct * chartH;
            return (
              <g key={i}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={width - padX + 8}
                  y={y + 3.5}
                  fontSize="9"
                  fill="#94a3b8"
                  textAnchor="start"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {formatMoney(pct * maxNet)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#salesGrad)" />

          {/* Curve stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive data dots */}
          {coords.map((c, i) => {
            const isHovered = hovered?.period === c.point.period;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(c.point)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isHovered ? 6 : 4}
                  fill={isHovered ? '#1d4ed8' : '#ffffff'}
                  stroke="#2563eb"
                  strokeWidth={isHovered ? '3' : '2'}
                  filter={isHovered ? 'url(#pointGlow)' : undefined}
                  className="transition-all duration-150"
                />
                {(i === 0 || i === coords.length - 1 || coords.length <= 6) && (
                  <text
                    x={c.x}
                    y={height - 8}
                    fontSize="9"
                    fill="#64748b"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontWeight="500"
                  >
                    {c.point.period.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Donut Chart for Sales by Category
 */
export function CategoryDonutChart({
  categories,
  title = 'توزيع المبيعات حسب النشاط',
}: {
  categories: CategoryShare[];
  title?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = categories.reduce((sum, c) => sum + c.net, 0);

  if (total <= 0 || categories.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-400">
        لا توجد بيانات تصنيفات كافية
      </div>
    );
  }

  // Consistent color palette for Iron & Paints ERP
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const radius = 60;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  const slices = categories.reduce<
    Array<{
      name: string;
      net: number;
      percentage: number;
      color: string;
      strokeDasharray: string;
      strokeDashoffset: number;
    }>
  >((acc, c, idx) => {
    const fraction = c.net / total;
    const prevOffset =
      acc.length > 0
        ? acc[acc.length - 1].strokeDashoffset - (acc[acc.length - 1].net / total) * circumference
        : 0;
    acc.push({
      ...c,
      color: COLORS[idx % COLORS.length]!,
      percentage: Math.round(fraction * 100),
      strokeDasharray: `${fraction * circumference} ${circumference}`,
      strokeDashoffset: prevOffset,
    });
    return acc;
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-400">نسبة مساهمة كل قطاع في صافي الإيراد</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 justify-around pt-2">
        {/* Donut Ring */}
        <div className="relative w-40 h-40 shrink-0">
          <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
            {slices.map((s, idx) => (
              <circle
                key={idx}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {hoveredIdx !== null ? (
              <>
                <div className="text-[11px] font-semibold text-slate-400">{slices[hoveredIdx]?.name}</div>
                <div className="text-base font-black text-slate-900">{slices[hoveredIdx]?.percentage}%</div>
              </>
            ) : (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الإجمالي</div>
                <div className="text-xs font-black text-slate-800">{formatMoney(total)}</div>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 w-full">
          {slices.map((s, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                hoveredIdx === idx ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-700 truncate font-semibold">{s.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-slate-900">{formatMoney(s.net)}</span>
                <span className="text-[11px] font-semibold text-slate-400">({s.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Liquidity and Cashflow Balance Bar
 */
export function CashFlowBar({
  salesNet,
  returnsTotal,
  receiptsTotal,
  paymentsTotal,
}: {
  salesNet: number;
  returnsTotal: number;
  receiptsTotal: number;
  paymentsTotal: number;
}) {
  const maxFlow = Math.max(salesNet, receiptsTotal, 1);
  const netOperating = receiptsTotal - paymentsTotal;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">ميزان التدفق المالي والسيولة</h3>
          <p className="text-xs text-slate-400">مقارنة المبيعات المحققة مقابل التحصيل والصرف الفعلي</p>
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-slate-400">صافي السيولة التشغيلية</div>
          <div
            className={`text-sm sm:text-base font-black ${
              netOperating >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatMoney(netOperating)}
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Sales vs Returns bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span>صافي المبيعات ({formatMoney(salesNet)})</span>
            <span className="text-red-600 font-bold">مرتجعات: {formatMoney(returnsTotal)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 flex">
            <div
              className="bg-gradient-to-l from-blue-600 to-blue-500 transition-all duration-500 rounded-r-full"
              style={{ width: `${Math.min(100, (salesNet / maxFlow) * 100)}%` }}
            />
            {returnsTotal > 0 && (
              <div
                className="bg-red-400 transition-all duration-500 rounded-l-full"
                style={{ width: `${Math.min(30, (returnsTotal / maxFlow) * 100)}%` }}
              />
            )}
          </div>
        </div>

        {/* Receipts vs Payments bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span className="text-emerald-700 font-bold">التحصيلات النقدية ({formatMoney(receiptsTotal)})</span>
            <span className="text-slate-600 font-bold">مصروفات: {formatMoney(paymentsTotal)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 flex">
            <div
              className="bg-gradient-to-l from-emerald-600 to-emerald-500 transition-all duration-500 rounded-r-full"
              style={{ width: `${Math.min(100, (receiptsTotal / maxFlow) * 100)}%` }}
            />
            {paymentsTotal > 0 && (
              <div
                className="bg-slate-400 transition-all duration-500 rounded-l-full"
                style={{ width: `${Math.min(50, (paymentsTotal / maxFlow) * 100)}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
