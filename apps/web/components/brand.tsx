import Image from 'next/image';
import type { HTMLAttributes } from 'react';

/**
 * BayanMark — Vector Monogram for Bayan ERP (Arabic 'ب' with industrial beam & MiB coral dot)
 */
export function BayanMark({
  size = 40,
  className = '',
  withGlow = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: number; withGlow?: boolean }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${withGlow ? 'shadow-lg shadow-blue-500/25' : ''} ${className}`}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
        aria-label="شعار نظام بيان ERP"
      >
        <defs>
          <linearGradient id="bayanGrad" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="60%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="beamGrad" x1="20" y1="35" x2="95" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
          <linearGradient id="coralDot" x1="55" y1="92" x2="65" y2="102" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#dc6c5b" />
          </linearGradient>
        </defs>

        {/* Container squircle */}
        <rect x="8" y="8" width="104" height="104" rx="28" fill="url(#bayanGrad)" />
        <rect
          x="8.5"
          y="8.5"
          width="103"
          height="103"
          rx="27.5"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
          fill="none"
        />

        {/* Arabic 'Baa' (ب) Structural Arc */}
        <path
          d="M34 38 V64 C34 74 42 82 52 82 H74 C82 82 88 76 88 68 V50"
          stroke="url(#beamGrad)"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Steel beam ledger */}
        <path d="M44 58 H80" stroke="#60a5fa" strokeWidth="3.5" strokeLinecap="round" />

        {/* Enterprise growth arrow */}
        <path
          d="M68 40 L88 40 L88 60"
          stroke="#93c5fd"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Signature MiB Coral Dot */}
        <circle cx="60" cy="95" r="5.2" fill="url(#coralDot)" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/**
 * BayanLogo — Complete Brand Lockup (Monogram + Arabic Title + Badge + Subtitle)
 */
export function BayanLogo({
  size = 'md',
  showSubtitle = true,
  theme = 'light',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}) {
  const markSizes = { sm: 32, md: 40, lg: 54 };
  const titleSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' };
  const badgeSizes = { sm: 'text-[9px] px-1 py-0.2', md: 'text-[10px] px-1.5 py-0.5', lg: 'text-xs px-2 py-0.5' };

  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <BayanMark size={markSizes[size]} withGlow={isDark} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight ${titleSizes[size]} ${isDark ? 'text-white' : 'text-slate-900'}`}>
            نظام بيان
          </span>
          <span
            className={`font-black uppercase tracking-wider rounded-md border font-mono ${badgeSizes[size]} ${
              isDark
                ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                : 'bg-blue-50 text-blue-700 border-blue-200/70'
            }`}
          >
            ERP
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`font-medium ${size === 'lg' ? 'text-xs' : 'text-[11px]'} ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            مبيعات وإدارة الحديد والبويات
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * MiBLogo — The Official MiB Technology Company Logo
 * Provides horizontal lockup, stacked badge, and monogram mark with crisp high-DPI assets
 */
export function MiBLogo({
  height = 28,
  variant = 'horizontal',
  theme = 'light',
  className = '',
}: {
  height?: number;
  variant?: 'horizontal' | 'stacked' | 'emblem';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}) {
  const isDark = theme === 'dark';
  let src = isDark ? '/brand/mib-horizontal-white.png' : '/brand/mib-horizontal.png';
  let ratio = 1036 / 240; // 4.32

  if (variant === 'stacked') {
    src = isDark ? '/brand/mib-logo-white.png' : '/brand/mib-logo.png';
    ratio = 763 / 552; // 1.38
  } else if (variant === 'emblem') {
    src = isDark ? '/brand/mib-emblem-white.png' : '/brand/mib-emblem.png';
    ratio = 624 / 432; // 1.44
  }

  const width = Math.round(height * ratio);

  return (
    <div
      className={`inline-flex items-center shrink-0 ${className}`}
      style={{ height }}
      title="MiB Technology — https://mibtek.net"
    >
      <Image
        src={src}
        alt="MiB Technology"
        width={width}
        height={height}
        className="h-full w-auto object-contain select-none"
        priority
      />
    </div>
  );
}

/**
 * BrandBadge — Co-Branded Lockup Badge
 * Shows "نظام بيان ERP" developed by "MiB Technology"
 */
export function BrandBadge({
  variant = 'sidebar',
  className = '',
}: {
  variant?: 'sidebar' | 'footer' | 'pill';
  className?: string;
}) {
  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-sm ${className}`}
      >
        <span className="text-[11px] font-bold text-slate-700">نظام بيان ERP</span>
        <span className="h-3 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-medium">بواسطة</span>
          <MiBLogo height={22} variant="horizontal" theme="light" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-3 transition-all hover:border-slate-300 shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <BayanMark size={32} />
          <div className="min-w-0">
            <div className="text-[12px] font-black text-slate-900 tracking-tight flex items-center gap-1">
              <span>نظام بيان</span>
              <span className="text-[10px] text-blue-600 font-bold">ERP</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">v1.0 الإنتاجية الموحدة</div>
          </div>
        </div>
        <div className="flex items-center pl-1 shrink-0" title="تقنية MiB Technology">
          <MiBLogo height={26} variant="horizontal" theme="light" />
        </div>
      </div>
    </div>
  );
}

/**
 * PoweredByMiB — Refined Corporate Signature for footers and modals
 */
export function PoweredByMiB({
  theme = 'light',
  variant = 'horizontal',
  height = 24,
  className = '',
}: {
  theme?: 'light' | 'dark';
  variant?: 'horizontal' | 'stacked' | 'emblem';
  height?: number;
  className?: string;
}) {
  const isDark = theme === 'dark';
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        تطوير وتشغيل
      </span>
      <MiBLogo height={height} variant={variant} theme={theme} />
    </div>
  );
}
