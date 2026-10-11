# ADR-0001: بنية Monorepo (pnpm workspaces + Turborepo)

- **الحالة:** مقبول ✅ (مُنفَّذ)
- **التاريخ:** 6 أكتوبر 2026
- **المرجع من PLAN:** §1 الحزمة التقنية

## السياق
النظام يتكوّن من: خادم NestJS + Prisma، لوحة ويب Next.js، تطبيق موبايل Flutter، وحزمة منطق حسابية مشتركة يجب أن تتطابق نسختاها (TS على الخادم والويب، وDart على الموبايل) تماماً. ضمّ كل شيء في نواة واحدة يمكّن من مشاركة الكود والاختبارات وتسهيل المزامنة بين الشقائق.

## القرار
- **Monorepo** بعمّلين `apps/` و`packages/` عبر **pnpm workspaces + Turborepo** للتنفيذ المتوازي للأوامر.
- `packages/shared`: أنواع TS + محرك الحسابات (دوال نقية) + اختبارات ذهبية.
- `apps/mobile` **ليست** عضواً في pnpm workspace (Flutter ليس pnpm package) — تُبنى بأمر `flutter` مستقل وله مهمة CI مستقلة (`mobile` job).
- `turbo.json` يصف مهام build/lint/test لكل workspace؛ وملاحظة Turborepo في `AGENTS.md` توجب قراءة وثائق النسخة المثبّتة قبل تعديل الإعدادات.

## العواقب
- ✅ بنية واحدة قابلة للاختبار من الجذر (`pnpm build` + `pnpm test`).
- ✅ مشاركة محرك الحسابات بين الخادم والويب، مع `packages/shared/tests` كأرض إثبات.
- ⚠️ Flutter خارج turbo يستلزم أوامر مستقلة ومهمة CI منفصلة (تمت في F4).

## المراجع
- `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml`
- `../PLAN.md` §1.