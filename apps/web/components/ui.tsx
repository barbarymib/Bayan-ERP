'use client';

import type { ReactNode } from 'react';

export { decomposeQty, type UnitDef, type UnitQty } from '@bayan/shared';

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-blue-700 hover:bg-blue-50',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-400">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ type, children }: { type: 'error' | 'success'; children: ReactNode }) {
  const cls =
    type === 'error'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${cls}`}>{children}</div>;
}

export function Spinner() {
  return <span className="inline-block animate-spin text-base text-gray-400">◌</span>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="px-3 py-2 text-start text-sm font-semibold text-gray-600">{children}</th>
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
    <td colSpan={colSpan} dir={dir} title={title} className={`px-3 py-2 text-sm text-gray-800 ${className}`}>
      {children}
    </td>
  );
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  const map: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${map[color] ?? map.gray}`}>
      {children}
    </span>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice type="error">
      <div className="flex items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry ? (
          <button className="underline underline-offset-2" onClick={onRetry}>
            إعادة المحاولة
          </button>
        ) : null}
      </div>
    </Notice>
  );
}

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