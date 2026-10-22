'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconClose,
  IconInfo,
} from './icons';

export { decomposeQty, type UnitDef, type UnitQty } from '@bayan/shared';

// ==========================================
// BUTTON COMPONENT
// ==========================================

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled,
  loading = false,
  icon,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const variantStyles: Record<string, string> = {
    primary:
      'bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500/30 disabled:bg-blue-300',
    secondary:
      'bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs hover:bg-slate-200/80 hover:text-slate-900 focus-visible:ring-slate-400/30 disabled:bg-slate-50 disabled:text-slate-400',
    outline:
      'bg-white text-slate-700 border border-slate-300 shadow-2xs hover:bg-slate-50 hover:border-slate-400 focus-visible:ring-slate-400/30 disabled:opacity-50',
    danger:
      'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/30 disabled:bg-red-300',
    success:
      'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500/30 disabled:bg-emerald-300',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300 disabled:opacity-50',
  };

  const sizeStyles: Record<string, string> = {
    xs: 'px-2.5 py-1 text-xs gap-1 rounded-md font-medium',
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg font-semibold',
    md: 'px-4 py-2 text-sm gap-2 rounded-xl font-semibold',
    lg: 'px-5 py-2.5 text-base gap-2 rounded-xl font-bold',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed tactile-btn ${variantStyles[variant] ?? variantStyles.primary} ${sizeStyles[size]} ${className}`}
    >
      {loading ? <Spinner className="w-4 h-4 text-current" /> : icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

// ==========================================
// FORM FIELD & CONTROLS
// ==========================================

export function Field({
  label,
  children,
  hint,
  required,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block text-start">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="block text-xs font-bold text-slate-700">
          {label}
          {required ? <span className="mr-1 text-red-500">*</span> : null}
        </span>
      </div>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
          <IconAlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] font-normal text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-150 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-500/15 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 shadow-2xs hover:border-slate-400';

export function TextInput({
  error,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={`${inputCls} ${error ? '!border-red-500 !focus:ring-red-500/20' : ''} ${className}`}
    />
  );
}

export function Select({
  error,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      {...props}
      className={`${inputCls} cursor-pointer ${error ? '!border-red-500 !focus:ring-red-500/20' : ''} ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({
  error,
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      className={`${inputCls} min-h-[80px] resize-y ${error ? '!border-red-500 !focus:ring-red-500/20' : ''} ${className}`}
    />
  );
}

// ==========================================
// ASYNC SEARCH PICKER (COMBOBOX)
// ==========================================

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export function AsyncSearchPicker({
  value,
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'اكتب للبحث...',
  options = [],
  onSearch,
  disabled = false,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  options?: PickerOption[];
  onSearch?: (query: string) => Promise<PickerOption[]>;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncResults, setAsyncResults] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery('');
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !onSearch || !query.trim()) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      onSearch(query.trim())
        .then((data) => {
          if (!cancelled) setAsyncResults(data);
        })
        .catch(() => {
          if (!cancelled) setAsyncResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen, onSearch]);

  const results = useMemo(() => {
    if (onSearch) {
      return query.trim() ? asyncResults : options;
    }
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)),
    );
  }, [onSearch, query, asyncResults, options]);

  const selectedOption =
    results.find((o) => o.value === value) || options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && (isOpen ? closeDropdown() : setIsOpen(true))}
        className={`${inputCls} flex items-center justify-between text-start cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <div className="truncate">
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedOption.label}</span>
              {selectedOption.sublabel ? (
                <span className="text-2xs text-slate-400 font-mono">({selectedOption.sublabel})</span>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-slate-600 rounded"
              title="مسح الاختيار"
            >
              <IconClose size={14} />
            </span>
          ) : null}
          <span className="text-2xs">▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-entrance">
          <div className="mb-2">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {loading ? (
              <div className="flex items-center justify-center p-4 text-xs text-slate-400">
                <Spinner className="w-4 h-4 mr-2" />
                <span>جارِ البحث…</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                لا توجد نتائج مطابقة
              </div>
            ) : (
              results.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    closeDropdown();
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs transition-colors ${
                    opt.value === value
                      ? 'bg-blue-50 font-bold text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel ? (
                      <div className="text-2xs font-mono text-slate-400 truncate">{opt.sublabel}</div>
                    ) : null}
                  </div>
                  {opt.badge ? (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-600">
                      {opt.badge}
                    </span>
                  ) : opt.value === value ? (
                    <IconCheck size={14} className="text-blue-600 shrink-0" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODAL COMPONENT
// ==========================================

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  description,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  description?: string;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const maxWMap: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative my-8 w-full ${maxWMap[size] ?? maxWMap.md} rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-entrance`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            aria-label="إغلاق"
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-6 py-5 text-start">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 bg-slate-50/70 px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ==========================================
// FEEDBACK & ALERTS
// ==========================================

export function Notice({
  type,
  children,
  className = '',
}: {
  type: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const config = {
    error: {
      box: 'bg-red-50/90 text-red-900 border-red-200',
      icon: <IconAlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />,
    },
    success: {
      box: 'bg-emerald-50/90 text-emerald-900 border-emerald-200',
      icon: <IconCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />,
    },
    warning: {
      box: 'bg-amber-50/90 text-amber-900 border-amber-200',
      icon: <IconAlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />,
    },
    info: {
      box: 'bg-blue-50/90 text-blue-900 border-blue-200',
      icon: <IconInfo size={18} className="text-blue-600 shrink-0 mt-0.5" />,
    },
  };

  const item = config[type] ?? config.info;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium leading-relaxed shadow-2xs ${item.box} ${className}`}>
      {item.icon}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Notice type="error">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-200 transition-colors"
          >
            إعادة المحاولة ⟳
          </button>
        ) : null}
      </div>
    </Notice>
  );
}

export function Spinner({ className = 'text-slate-400' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ==========================================
// PAGE HEADER & STRUCTURE
// ==========================================

export function PageHeader({
  title,
  action,
  description,
  badge,
}: {
  title: string;
  action?: ReactNode;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          {badge ? <div>{badge}</div> : null}
        </div>
        {description ? <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

// ==========================================
// TABLE COMPONENTS
// ==========================================

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs ${className}`}>
      <table className="w-full border-collapse text-start text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-600 uppercase tracking-wider">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-blue-50/30 transition-colors ${className}`}>{children}</tr>;
}

export function Th({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 text-start text-xs font-bold text-slate-600 ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = '',
  dir,
  colSpan,
  title,
}: {
  children?: ReactNode;
  className?: string;
  dir?: string;
  colSpan?: number;
  title?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      dir={dir}
      title={title}
      className={`px-4 py-3 text-xs sm:text-sm text-slate-700 align-middle ${className}`}
    >
      {children}
    </td>
  );
}

// ==========================================
// BADGES & TAGS
// ==========================================

export function Badge({
  color,
  children,
  dot = false,
  className = '',
}: {
  color: string;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const map: Record<string, { bg: string; dot: string }> = {
    green: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
    red: { bg: 'bg-red-50 text-red-700 border-red-200/80', dot: 'bg-red-500' },
    gray: { bg: 'bg-slate-100 text-slate-700 border-slate-200/80', dot: 'bg-slate-400' },
    blue: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50 text-purple-700 border-purple-200/80', dot: 'bg-purple-500' },
  };

  const selected = map[color] ?? map.gray;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${selected.bg} ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${selected.dot}`} /> : null}
      <span>{children}</span>
    </span>
  );
}

// ==========================================
// CARD PRIMITIVES
// ==========================================

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs craft-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

// ==========================================
// STAT CARD (KPI)
// ==========================================

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'text-slate-900',
  trend,
  href,
  onClick,
  className = '',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  tone?: string;
  trend?: { label: string; positive?: boolean };
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const isClickable = Boolean(href || onClick);

  const cardContent = (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs craft-card transition-all duration-200 ${
        isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xs group' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</span>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100 group-hover:scale-105 group-hover:bg-blue-50/50 transition-all">
            {icon}
          </div>
        ) : null}
      </div>
      <div className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${tone}`}>{value}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        {subtitle ? <span className="text-slate-400 font-normal">{subtitle}</span> : <span />}
        {trend ? (
          <span
            className={`font-semibold ${
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {trend.label}
          </span>
        ) : isClickable ? (
          <span className="text-2xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            عرض التفاصيل ↗
          </span>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block text-inherit no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

// ==========================================
// EMPTY STATE COMPONENT
// ==========================================

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-xs border border-slate-200">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export function formatMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('ar-EG-u-nu-arab');
}

export function formatDateGregorian(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleString('ar-EG');
}

export function formatDateHijri(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v;
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-arab', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return formatDateGregorian(d);
  }
}

export function formatDate(v: string): string {
  return formatDateGregorian(v);
}

export function toArabicNumerals(s: string | number): string {
  return String(s).replace(/[0-9]/g, (c) => '٠١٢٣٤٥٦٧٨٩'[Number(c)]);
}

export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}