# ADR-0015: تشفير البيانات الساكنة على الخادم (Data-at-rest encryption)

- **الحالة:** مقبول ✅ (موثّق — التفعيل التشغيلي حسب بيئة النشر)
- **التاريخ:** 18 أكتوبر 2026

## السياق
البند §9 في `../bayan-design.md` يتطلّب «تشفير قاعدة البيانات الحساسة». الوضع الحالي:

- **النسخ الاحتياطية المشفّرة:** AES-256-GCM عبر `apps/api/src/backups/crypto.util.ts` بمفتاح `BACKUP_ENCRYPTION_KEY` (64 hex) — ملتزَم به في الإنتاج (`crypto.util.ts:24` يرفض الغياب في production).
- **بيانات الموبايل الساكنة:** SQLCipher + `flutter_secure_storage` (G5).
- **قاعدة بيانات الخادم:** تُخزَّن **غير مشفّرة على القرص** (plaintext at rest)؛ RLS يعزل المستأجرين منطقياً فقط، ولا يحمي من الوصول الفيزيائي/النسخ على مستوى القرص.

كذلك، تفعيل RLS (`FORCE ROW LEVEL SECURITY` — الترحيل `20261012000000_rls_tenant_isolation`) أوقف `pg_dump` بدور التطبيق `bayan`، مما استلزم دوراً متجاوزاً (انظر القرار أدناه).

## القرار
لا نطبّق تشفير أعمدة على مستوى التطبيق (تكلفة/مخاطر ترحيل بيانات قائمة). بدلاً من ذلك **نوثّق ونوصي** بتشفير البيانات الساكنة حسب البيئة:

1. **الموصى به: تشفير القرص/الحجم (LUKS أو تشفير حجم سحابي).**
   - خيار A (خادم/VM): `dm-crypt`/LUKS على قسم/حجم بيانات PostgreSQL (`/var/lib/postgresql`).
   - خيار B (سحابي): تشفير الحجم المُدار من مزوّد الخدمة (encryption-at-rest) + مفتاح يديره المزوّد (KMS).
   - التحقق: `lsblk -f` / `cryptsetup status` / `dmsetup ls` يظهران `crypt`؛ أو شهادة تشفير الحجم من لوحة المزوّد.
   - ملاحظة: التفعيل يتطلّب نافذة صيانة وإعادة إنشاء الحجم — يُخطَّط خارج ساعات العمل.

2. **الحماية الإضافية للنسخ:** النسخ الاحتياطية تُكتب دائماً مشفّرة (AES-256-GCM) قبل حفظها في `ObjectStorage`، فلا تحتوي النسخة على بيانات سائبة.

3. **متطلب تشغيلي: دور `pg_dump` متجاوز لـ RLS.**
   - الجداول ذات `FORCE ROW LEVEL SECURITY` تفشل في `pg_dump` بدور التطبيق (`bayan`).
   - الحل المعتمد: دور مخصّص `bayan_backup` (`LOGIN BYPASSRLS` + `GRANT pg_read_all_data`) وتوجيه `BACKUP_DATABASE_URL` إليه، مع إبقاء `DATABASE_URL` (دور التطبيق `bayan`) خاضعاً لـ RLS.
   - إنشاء الدور (يُنفَّذ مرة واحدة لكل بيئة، بكلمة مرور عشوائية):
     ```sql
     CREATE ROLE bayan_backup LOGIN PASSWORD '<random-hex>' BYPASSRLS;
     GRANT pg_read_all_data TO bayan_backup;
     ```
   - متغيّرات البيئة: `BACKUP_DATABASE_URL` (dور النسخ، اختياري — يرجع إلى `DATABASE_URL` إن غاب)، `BACKUP_ENCRYPTION_KEY`، `STORAGE_DRIVER`/`STORAGE_LOCAL_DIR`.

4. **للحقول شديدة الحساسية مستقبلاً (اختياري):** يمكن استخدام إضافة `pgcrypto` (`pgp_sym_encrypt`) لتشفير أعمدة محدّدة بمفتاح من البيئة — تُدرَج كترحيل مُؤهَّل (`public.`) عند الحاجة، دون اعتمادها الآن.

## العواقب
- ✅ متطلّب §9 موثّق مع خطوات تحقق واضحة لكل بيئة.
- ✅ النسخ الاحتياطية تعمل مجدداً تحت RLS عبر `bayan_backup` (BYPASSRLS) دون إضعاف عزل التطبيق.
- ✅ لا مخاطرة على البيانات القائمة (لا تغيير مخطط/بيانات).
- ⚠️ التشفير على مستوى الحجم يبقى مسؤولية تشغيلية لا يكتمل تلقائياً من الكود.
- ⚠️ حماية ضد الوصول الفيزيائي تعتمد على بقاء مفاتيح LUKS/KMS خارج الخادم.

## المراجع
- `apps/api/src/backups/crypto.util.ts`, `apps/api/src/backups/backups.service.ts` (`resolveDumpDatabaseUrl`).
- `apps/api/src/migration/migration.service.ts` (نسخة قبل الترحيل — R3-E2).
- `apps/api/prisma/migrations/20261012000000_rls_tenant_isolation/migration.sql` (FORCE RLS).
- `../bayan-design.md` §9; R3-E2/E2b/E3 في `../GAP.md`.
