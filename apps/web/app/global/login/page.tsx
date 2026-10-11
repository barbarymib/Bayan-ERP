'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Notice, TextInput } from '@/components/ui';
import { GLOBAL_API, setGlobalToken } from '@/lib/global';

export default function GlobalLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${GLOBAL_API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error('بيانات دخول غير صحيحة');
      const data = (await res.json()) as { accessToken: string };
      setGlobalToken(data.accessToken);
      router.replace('/global/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700 text-2xl font-black text-white">
            ع
          </div>
          <h1 className="text-xl font-black text-gray-900">الإدارة العامة للبيئة</h1>
          <p className="mt-1 text-sm text-gray-500">الشركات والميزات — SaaS</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="اسم المستخدم">
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" autoFocus required />
          </Field>
          <Field label="كلمة المرور">
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </Field>
          {error ? <Notice type="error">{error}</Notice> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'جارِ الدخول…' : 'دخول'}
          </Button>
        </form>
      </div>
    </div>
  );
}