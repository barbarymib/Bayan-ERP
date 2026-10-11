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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">
            ب
          </div>
          <h1 className="text-xl font-black text-gray-900">نظام بيان</h1>
          <p className="mt-1 text-sm text-gray-500">مبيعات الحديد والبويات — تسجيل الدخول</p>
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
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'جارِ الدخول…' : 'دخول'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          <a href="/global/login" className="hover:text-blue-600">
            دخول المشرف العام للبيئة
          </a>
        </p>
      </div>
    </div>
  );
}