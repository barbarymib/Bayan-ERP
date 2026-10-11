import { formatDocNumber } from '@bayan/shared';

export default function Home() {
  const sampleNumber = formatDocNumber('BP', 'M03', 127);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">بيان</h1>
        <p className="mt-3 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          نظام مبيعات الحديد والبويات — جملة وقطاعي
        </p>
        <div
          dir="ltr"
          className="mt-8 rounded-lg bg-zinc-100 px-4 py-3 font-mono text-lg text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {sampleNumber}
        </div>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
          مثال على ترقيم بيانات الأسعار (آمن للعمل أوفلاين)
        </p>
      </main>
    </div>
  );
}
