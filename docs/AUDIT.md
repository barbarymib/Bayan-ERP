# Bayan ERP — Full System Audit

- **التاريخ:** 11 أكتوبر 2026
- **النطاق:** `apps/api` (NestJS 11 + Prisma 7)، `apps/web` (Next 16 / React 19)، `apps/mobile` (Flutter 3.47 / Riverpod 3 / Drift)، `packages/shared`، البنية التحتية (Docker/CI)، الوثائق.
- **الطريقة:** قراءة الكود فقط + بوابات الجودة + فحص الأسرار/التكوين. كل ناتج مذكور هنا مُتحقَّق منه مقابل المصدر (مع الإشارة إلى `file:line`).

## ملخّص بوابات الجودة (كلها خضراء)
- الجذر: `pnpm build` 3/3، `pnpm test` (api 110/110، shared 71/71)، `pnpm lint` 3/3، `pnpm typecheck` 4/4.
- الموبايل: `flutter analyze` 0، `flutter test` 176/176.
- النظافة: 0 TODO/FIXME، 0 `: any` في المصدر، 0 `@ts-ignore`، 3 `eslint-disable` (hooks deps فقط)، لا `print` في `lib/`.
- Git: المستودع بلا أي commit (`git ls-files` = 0)؛ `apps/api/.env` مُتجاهَل عبر `.gitignore:11` (ليس سرًّا مُسرَّبًا).

## حرج (CRITICAL)
1. **سرّ JWT افتراضي ضعيف** — `apps/api/src/auth/auth.module.ts:12`: `process.env.JWT_SECRET ?? 'dev-only-secret-change-me'`. لو غاب المتغيّر في الإنتاج تُصنَّع الرموز. **تمّ إصلاحه:** يفشل الإقلاع في الإنتاج إن غاب/قصُر.
2. **بيانات اعتماد تخزين افتراضية** — `apps/api/src/common/object-storage.s3.ts:28-29` (`minioadmin/minioadmin`) و`docker-compose.yml:7-10,43-45`. **تمّ إصلاحه جزئيًا:** يفشل الإقلاع في الإنتاج عند غياب الاعتمادات الصريحة؛ compose ما زال بحاجة لتوسيط env.
3. **APK الإصدار بلا صلاحية شبكة** — `apps/mobile/android/app/src/main/AndroidManifest.xml` لا يعلن `INTERNET` (فقط `debug/` و`profile/`). **تمّ إصلاحه:** أُضيفت الصلاحية.

## عالٍ (HIGH)
4. **تخزين الرمز بنص صريح** — الويب: `localStorage` (`lib/auth.tsx:75`، `lib/api.ts:415-422`، `lib/global.ts:3`)؛ الموبايل: `SharedPreferences` (`lib/core/session_store.dart:9-10,37-40`). التوصية: httpOnly/secure + CSP؛ `flutter_secure_storage` على الموبايل.
5. **غياب تحصين HTTP** — `main.ts` بلا helmet/CORS/rate-limit، وSwagger مكشوف دائمًا. **تمّ إصلاحه جزئيًا:** أُضيف CORS قابل للضبط + Throttler عام + تقييد Swagger بالإنتاج. helmet غير متاح offline (يُضاف في CI/أونلاين).
6. **عبارة مرور احتياطية لتشفير النسخ** — `apps/api/src/backups/crypto.util.ts:24`. **تمّ إصلاحه:** يفشل في الإنتاج إن غاب المفتاح 64-hex.
7. **توقيع الإصدار بمفتاح debug** — `android/app/build.gradle.kts` يستخدم `signingConfigs.debug`.
8. **صفحة الويب `(app)/page.tsx` غير قابلة للوصول** — تعارض مسار `/` مع `app/page.tsx` (بنية Next تخدم الأولى). تتطلّب قرار منتج (حذف/نقل).

## متوسط (MEDIUM)
9. لا آلية refresh للرمز (JWT عمره `1d`).
10. حماية الويب داخل المتصفح فقط (لا `middleware.ts`) — `RequireAuth` عميل عبر `lib/auth.tsx:94-111`.
11. `ValidationPipe` بلا `forbidNonWhitelisted` (`main.ts:13`).
12. قاعدة Drift على الموبايل غير مشفَّرة (بيانات مالية/PII).
13. ثغرات `.gitignore`: لا أنماط لمفاتيح Firebase/keystore/تفريغات DB.
14. ثغرات CI: لا فحص تبعيات/أسرار/تحقّق من المِهاجرات؛ انزياح إصدار pnpm (CI `12` مقابل `12.9.1`).
15. عزل المستأجرين على مستوى الخدمة فقط (`tenantWhere`) — لا حارس عام.
16. تضارب `@types/node` بين الويب (`^20`) والـ API/الجذر (`^24`).

## منخفض / معلومات
- `catch (_) {}` صامتة في الموبايل (`api_client.dart:74`، `data_store.dart:259`، `shift_controller.dart`).
- `bluetooth_print_plus` يعتمد على الكاش المحلي؛ تثبيت `drift`/`drift_dev`/`build_runner` (مقصود).
- لا `Dockerfile` للتطبيقات (compose للبنية فقط)؛ `next.config.ts` فارغ.
- مِهاجرة `tenant_core_composite_uniques` تُسقط فهارس فريدة عامة (مخطّط فقط، بلا DML) — خُذ نسخة قبل النشر.

## الإيجابيات
حارس مصادقة عام (`APP_GUARD` مع `@Public/@GlobalAdmin/@Permissions` + أعلام ميزات + فحص حالة المستخدم/الشركة)، `ValidationPipe` (whitelist+transform) + DTOs، **لا استعلامات SQL خام**، عزل مستأجرين واسع + قيود مركّبة، وحدة تدقيق عامة `@Global()`، بوابة موافقة موقع على الموبايل، اختبارات وفيرة.

## أولويات المعالجة
1. إدارة الأسرار (JWT/BACKUP/S3) + توسيط `docker-compose.yml`. *(جزئيًا: متمّ)*
2. صلاحية `INTERNET` + توقيع الإصدار للموبايل. *(جزئيًا: INTERNET متمّ)*
3. تحصين الـ API (CORS/Throttler/Swagger + helmet لاحقًا). *(جزئيًا: متمّ)*
4. تخزين آمن للرموز + middleware للويب.
5. حلّ تعارض مسار `/` في الويب.
6. `.gitignore` + تكافؤ CI (audit/secret-scan/migrate-check).

## الالتزامات المرجعية
- `apps/api/src/{main.ts,auth/auth.module.ts,app.module.ts,backups/crypto.util.ts,common/object-storage.s3.ts}`.
- `apps/web/{lib/api.ts,lib/auth.tsx,lib/global.ts,app/page.tsx,app/(app)/page.tsx,app/(app)/layout.tsx}`.
- `apps/mobile/{lib/core/session_store.dart,lib/core/api_client.dart,lib/core/providers.dart,android/app/src/main/AndroidManifest.xml,android/app/build.gradle.kts}`.
- `docker-compose.yml`, `.github/workflows/ci.yml`, `.gitignore`.

## تحديث المعالجة (11 أكتوبر 2026) — الجولة الثانية
تم تنفيذ الإصلاحات المعتمدة، وكل بوابات الجودة خضراء (api build/lint/typecheck + vitest **117/117**؛ web typecheck/lint/build؛ flutter analyze 0 + **179/179**؛ `prisma validate` صالح).
1. **حرج/أسرار:** فشل إقلاع صريح في الإنتاج عند غياب `JWT_SECRET`/`BACKUP_ENCRYPTION_KEY`/بيانات S3 (تمّ). صلاحية `INTERNET` في بيان أندرويد الرئيسي (تمّ). CORS + Throttler عام + تقييد Swagger بالإنتاج (تمّ؛ helmet غير متاح offline).
2. **تخزين آمن للرموز + middleware:** أُضيف `apps/web/proxy.ts` (بديل middleware في Next 16) يحمي كل مسارات `(app)` عبر cookie `bayan_auth` ولوحة المشرف العام عبر `bayan_global`، مع ربطه بـ `syncAuthCookie` في `lib/api.ts` و`lib/global.ts`. (تخزين الرموز ما زال localStorage/SharedPreferences — التحويل إلى httpOnly/secure storage بند لاحق.)
3. **refresh tokens:** مسار `POST /api/auth/refresh` + زوج رموز (access قصير + refresh 7 أيام) في `AuthService`؛ الويب والموبايل يجرّبان تلقائيًا عند 401 (‏`request`/`ApiClient._send`)؛ `AuthGuard` يرفض رمز التحديث كوصول. اختبارات: +7 (api) و+3 (mobile).
4. **حلّ تعارض `/`:** نُقلت لوحة المعلومات إلى `(app)/dashboard` ووُجّه الدخول إليها، وبقيت صفحة التسويق على `/` (تحقّق وقت التشغيل: `/`=200، `/dashboard`=307→`/login`، cookie→200).
5. **توقيع الإصدار:** `build.gradle.kts` يقرأ `android/key.properties` (غير مُتتبَّع) مع رجوع لمفاتيح debug عند غيابه؛ أُضيف `key.properties.example`.
6. **CI:** تثبيت pnpm 12.9.1؛ خطوات `pnpm audit` (متعثّرة لكن غير حاجزة)، فحص أسرار، و`prisma validate`.
7. **إدخال أكثر صرامة:** `forbidNonWhitelisted` مُفعّل (تمّ التحقق أن حقولًا غير معروفة على `/auth/login` → 400). ⚠️ يستلزم لمسة تحقق يدوية على مسارات الإنشاء غير المصادقة لضمان عدم إرسال عملاء الويب/الموبايل حقولًا إضافية.

