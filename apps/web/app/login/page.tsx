'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button, Notice, TextInput, Field } from '@/components/ui';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  if (user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4">
      {/* Background Decorative Ambient Glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-xl border border-white/20 animate-entrance">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-3xl font-black text-white shadow-lg ring-4 ring-blue-500/20">
            ب
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">نظام بيان</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            مبيعات وإدارة الحديد والبويات — تسجيل الدخول
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="البريد الإلكتروني أو رقم الهاتف">
            <TextInput
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@bayan.local أو 011…"
              autoFocus
              required
            />
          </Field>
          <Field label="كلمة المرور">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {error ? <Notice type="error">{error}</Notice> : null}

          <Button type="submit" loading={busy} className="w-full mt-2 py-2.5 text-sm font-bold shadow-md">
            دخول إلى النظام
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <a
            href="/global/login"
            className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors"
          >
            دخول المشرف العام للمنصة (SaaS Admin) ←
          </a>
        </div>
      </div>
    </div>
  );
}