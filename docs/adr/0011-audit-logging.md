# ADR-0011: التسجيل التدقيقي (AuditLogs)

- **الحالة:** مقبول ✅ (مُنفَّذ)
- **التاريخ:** 6 أكتوبر 2026

## السياق
المتطلب §5.15: سجل تدقيقي لكل الأحداث المالية/الحوكمة (إنشاء/تعديل/إلغاء/موافقة/ترحيل/إعدادات…). كان سابقاً جزئياً (price.change, approval.decide فقط). اختير (B5) تغطية «النواة المالية/المخزنية/الحوكمة» بناءً على موافقة المسؤولة.

## القرار
- **`AuditLogsService.write({userId?, action, entity, entityId, beforeJson?, afterJson?})`** — موديول `@Global()` يُحقن في أي خدمة دون `imports` مكررة.
- **اصطلاح action:** `<entity>.<verb>` (مثل `statement.cancel`, `collection.receipt`, `cheque.status`, `handover.create`, `daily_close.run`, `purchase_order.approve`, `stocktake.counts`, `transfer.execute`, `supplier_return.create`, `quotation.send`, `user.create`, `company.feature`, `setting.update`, `migration.import`, `archive.run`).
- أُعيدت تسمية أكواد قديمة بلا مراجع خارجية: `close`/`reclose`→`daily_close.run`؛ `create` (entity transfer) → `transfer.execute`؛ `create` (entity supplier_return) → `supplier_return.create`.
- **before/after JSON** حسبة للمواد المالية؛ `entityId` إجباري Int (0 لأزواج key/value كالإعدادات والهجرة)؛ وأحداث المشرف العام تُسجَّل `userId` بلا وتضيف `actor` (الاسم/الاسم العام) في afterJson (userId FK لموظف الشّركة لا لـGlobalAdmin).
- الكتابة **خارج `$transaction`** عند الإمكان (تجنّب client داخل معاملة؛ مبادلة بعدد الخيارات).

## العواقب
- ✅ سجل تدقيق كامل لنواة العمليات + منظور ويب `/audit-logs`.
- ✅ اصطلاح موحّد يسهل التتبع والفهرسة.
- ⚠️ أي خدمة جديدة يجب أن تستدعي `audits.write` — قيد دائم يُضاف للمراجعة.

## المراجع
- `apps/api/src/audit-logs/*`, `apps/api/src/{price-statements,returns,collections,treasury,purchase-orders,stocktakes,transfers,supplier-returns,quotations,users,admin,settings,migration,archives}/*`.
- B5 في `../memory.md`, `../bayan-design.md` §5.15.