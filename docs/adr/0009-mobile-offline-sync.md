# ADR-0009: المزامنة أوفلاين للهاتف (Drift + Outbox + Delta)

- **الحالة:** مقبول ✅ (مُنفَّذ)
- **التاريخ:** 6 أكتوبر 2026

## السياق
المندوب يعمل بلا اتصال: ينشئ بيانات/مرتجعات/تحصيلات أوفلاين، تُخزَّن محلياً ثم تُدفع؛ ويستقبل تحديثات الأصناف/العملاء/الأسعار عند الاتصال. يجب أن لا يُفقد شيء وأن تُحلّ التعاريف (سعر/رصيد تغيّر).

## القرار
- **تخزين محلي Drift (SQLite)** بمعرّف UUID للمستندات المحلية (`client_uuid`)، وطبقة `DataStore` تجمّع به اختيار المحركات.
- **Outbox** (جدول مخرجات) بكل عملية pending وحالة `SYNCED/PENDING_REVIEW/FAILED` وقيم ASCII لجهد إخراج موثوق، مع **retry/backoff** (E6) وإظهار أسطح PENDING_REVIEW.
- **Delta pull**: `GET /sync/delta?since=` يرجع الأصناف (nameAr/baseUnit) والعملاء (المعيّنين عبر `CustomerRepAssignment.repId`) ورصيدهم (`openingBalance + Σ ledger`) وكتل الأرقام.
- **Push**: لكل عنصر outbox محاولة مُفردة try/catch؛ بيان السعر (`price_statement`) يُفوَّض إلى `PriceStatementsService.create`، المرتجعات (`return_statement`) إلى `ReturnsService.create`، والتحصيلات/الشيكات (`receipt`) إلى `CollectionsService.createReceipt` — كلها عبر uuid (idempotent)؛ `net_mismatch>0.01` ← PENDING_REVIEW، وأي نوع غير معروف ← PENDING_REVIEW مع `type_<type>_not_supported_yet`.
- مخطط الحالة: `APPROVED/PENDING_REVIEW/CANCELLED→REJECTED/UPLOADED`.

## العواقب
- ✅ لا تكرار أرقام ولا فقدان (uuid + كتل أرقام).
- ✅ مرئية واضحة لتعارض السعر/الرصيد وليست صامتة.
- ✅ المرتجعات (`return_statement`) والتحصيلات/الشيكات (`receipt`) وبيانات السعر مدعومة جميعها في دفع الـoutbox؛ أي نوع غير معروف يُعاد `PENDING_REVIEW` (نقطة امتداد مخطط لها).

## المراجع
- `apps/api/src/sync/*`, `apps/mobile/lib/core/{db,data_store,sync}/*`.
- `../bayan-design.md` §5.12-5.13، `../PLAN.md` المرحلة 4، E6 في `../memory.md`.