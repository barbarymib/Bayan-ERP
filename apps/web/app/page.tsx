import Link from 'next/link';
import { formatDocNumber } from '@bayan/shared';

export default function Home() {
  const sampleNumber = formatDocNumber('BP', 'M03', 127);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-gray-900">
      {/* شريط علوي */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white shadow-md shadow-blue-500/20">
              ب
            </span>
            <div>
              <div className="text-lg font-black tracking-tight text-gray-900">نظام بيان</div>
              <div className="text-xs text-gray-500">Bayan ERP — الإصدار 1.0</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/global/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              المشرف العام
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      {/* القسم الرئيسي البصري (Hero) */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700 mb-6">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
          نظام متكامل لتجارة الحديد ومواد البناء والبويات (جملة وقطاعي)
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 leading-tight">
          إدارة مبيعات دقيقة، مخازن ذكية،
          <br />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            وتتبع ميداني يعمل أونلاين وأوفلاين
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed">
          نظام عربي متكامل (RTL) مبني خصيصاً لمتطلبات سوق الحديد والبويات: تسعير يومي، وحدات قياس متعددة ومركبة، محرك خصومات واحتساب أوزان، وتطبيق مناديب محمي بتقنيات التشفير الحديثة.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all hover:scale-[1.02]"
          >
            الدخول إلى لوحة التحكم
            <span aria-hidden="true">&larr;</span>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-7 py-3.5 text-base font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            استعراض المؤشرات الحية
          </Link>
        </div>

        {/* بطاقة مثال الترقيم المالي */}
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">نمط الترقيم الرسمي (آمن تماماً أوفلاين)</div>
          <div dir="ltr" className="mt-2 text-2xl font-black font-mono tracking-wider text-blue-600">
            {sampleNumber}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            بيان أسعار (BP) • كود المندوب (M03) • تسلسل لا يتكرر ولا يتعارض
          </div>
        </div>
      </section>

      {/* شبكة الميزات الأساسية */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 text-xl font-bold mb-4">
              ف
            </div>
            <h3 className="text-lg font-bold text-gray-900">بيانات الأسعار والتسعير</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              إصدار بيانات أسعار (BP-)، خصومات بنود وإجمالي بنسب وقيم موزعة، تسعير يومي للحديد، وتنبيهات البيع بأقل من التكلفة.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 text-xl font-bold mb-4">
              م
            </div>
            <h3 className="text-lg font-bold text-gray-900">المخازن والوحدات المركبة</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              أصناف متعددة الوحدات (طن، سيخ، عبوة، كرتونة)، حركات تحويل واستلام، جلسات جرد وتجميد رصيد، وتقييم مخزون فوري.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 text-xl font-bold mb-4">
              ط
            </div>
            <h3 className="text-lg font-bold text-gray-900">تطبيق المناديب والتتبع</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              تطبيق موبايل يعمل كاملاً Offline بمحرك مشفر، تزامن تفاضلي Delta Sync، تتبع جغرافي للورديات ومطابقة موقع العميل.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 text-xl font-bold mb-4">
              ر
            </div>
            <h3 className="text-lg font-bold text-gray-900">الترحيل والأرشفة الآمنة</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              إغلاق الفترات وترحيل البيانات لحزم خارجية (Excel و SQLite و JSON) مع تدوير الأرصدة الافتتاحية والنسخ الاحتياطي المشفر.
            </p>
          </div>
        </div>
      </section>

      {/* التذييل */}
      <footer className="border-t border-gray-200 bg-white mt-12 py-8 text-center text-xs text-gray-500">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>نظام «بيان» لمبيعات وتوزيع مواد البناء — شركة MiB Technology © 2026</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-blue-600 transition-colors">
              تسجيل الدخول
            </Link>
            <span>•</span>
            <Link href="/global/login" className="hover:text-blue-600 transition-colors">
              لوحة المشرف العام
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
