# Bayan ERP — Gap Analysis vs. Design Spec

> Generated from a 6-subagent parallel review of the codebase against `docs/bayan-design.md`,
> with the security-sensitive RBAC/tenant findings re-verified directly by hand.
> Each gap has an ID (`G##`) so the remediation backlog at the bottom can reference it.

- **Spec:** `docs/bayan-design.md` (672 lines; §4 RBAC, §5 features, §7 data/calc, §8 screens, §9 NFR, §12 SaaS).
- **Scope reviewed:** `apps/api` (NestJS + Prisma), `packages/shared` (calc engine), `apps/web` (React), `apps/mobile` (Flutter/Drift).
- **Legend — Status:** `MISSING` | `PARTIAL` | `DEVIATION` (intentional/documented difference).
- **Legend — Severity:** `H` high (security / data loss / spec-critical) · `M` medium · `L` low.
- **Evidence** cites `path:line` where verified; otherwise the owning module.

---

## 1. Confirmed strengths (not gaps)

- All **30 §7.3 tables present** in `apps/api/prisma/schema.prisma`.
- **11/12 §7.4 equations** implemented in `packages/shared` and mirrored in Dart; §14 worked examples asserted in both runtimes.
- Core flows implemented and RBAC-gated: price statements, multi-unit, returns, transfers, purchases/PO, ledger, treasury, stocktake, periods, archive, sync, geo.
- Hardening already done: HTTPS/HSTS via nginx, `ValidationPipe` (`forbidNonWhitelisted`), CORS, Swagger restricted, rate-limit, prod startup guards for JWT/S3/backup keys, refresh tokens, mobile `INTERNET` permission.
- Mobile delta sync + retry/backoff + Drift store working.

---

## 2. Findings

### High severity

| ID  | Gap | Spec | Status | Evidence |
| --- | --- | ---- | ------ | -------- |
| G1 | **Cost leak via quotations** — `GET /quotations`, `GET /quotations/:id` and the create response return `costSnapshot` + `item.lastPurchaseCost` with **no `cost.view` gate/masking**. Any authenticated user (incl. storekeeper/rep) sees cost. | §4.2 "رؤية سعر التكلفة" | FIXED | Was: `apps/api/src/quotations/quotations.controller.ts:25-35`; now masked via `stripCost` (`quotations.service.ts`), mirroring `price-statements.service.ts:372`. |
| G2 | **§5.14 reporting is skeletal.** Only 6 endpoints (stock values, movements, low-stock, stock summary, dashboard, aging). Missing sales / discounts / returns / stopped-customers / stocktake-diff / rep-performance / supplier-debt reports. Export is **CSV-only**; spec asks XLSX (+ PDF). | §5.14 | PARTIAL | `apps/api/src/reports/reports.controller.ts`; no `xlsx`/exceljs dependency in `apps/api/package.json`.
- **G3** `FIXED` — **Statement revisions not recorded** on edit-after-approval. Added `PATCH /price-statements/:id` (`price-statements.controller.ts`) → `PriceStatementsService.update`: drafts/pending-review need `statement.edit`; an **approved** statement needs `statement.edit_approved`, then the prior state is snapshotted into `statement_revisions` (`revisionNo = max+1`) and the postings are **reversed** (`stock.restock` + customer-ledger credit) and **re-posted** with the new lines (`stock.saleOut` + debit) in one transaction, keeping status `APPROVED`; refused when `paid > 0` (mirrors cancel). Audited as `statement.edit` / `statement.edit_approved`; `GET /price-statements/:id` now returns `revisions`. Shared `resolveLines`/`buildLineRows`/`buildApprovals` extracted from `create`. Tests: `apps/api/tests/price-statements.service.spec.ts` (9). Was: `StatementRevision` written only by archive *restore* (`apps/api/src/archives/archives.service.ts:918`); no edit endpoint existed (drafts or approved). Spec §5.6 "نسخة معدلة… لا حذف مباشر" + §4.2 `statement.edit_approved`.
- **G4** `FIXED` — **Mobile device trust.** API: `DeviceGuard` (`apps/api/src/auth/device.guard.ts`) now enforces an active `x-device-id` on every `/sync` route except `device/register` (`@SkipDeviceCheck`); a revoked/unknown/missing device gets 403/400 so revoke cuts sync immediately (the guard pins the RLS tenant via `setTenant` since guards run before `TenantContextInterceptor` and Prisma resolves the GUC lazily at await). New `DevicesModule` exposes `GET /devices` + `POST /devices/:id/revoke|activate`, gated by a new `device.manage` permission (OWNER/REP_SUPERVISOR/ADMIN). Mobile: registration is now fail-loud (`auth_controller.dart` clears the token/session and surfaces the error), `ApiClient` sends `X-Device-Id` on every call, and a biometric gate (`device_lock_gate.dart`/`device_lock.dart` via `local_auth`, PIN/password fallback, toggle in the home menu) locks the app on cold start/resume. Web: `/devices` admin page (list + revoke/activate + nav). Verified live: `verify-g4-live.mjs` **17 OK / 0 FAIL** (401/403 auth, 400 missing header, 403 unknown/inactive, 200 active, revoke→403 instantly, activate→200); api 153 tests, mobile 190. Was: registration failure swallowed, no remote revoke, no device lock. (§9)
- **G5** `FIXED` — **Mobile secrets at rest:** Drift DB opened encrypted via `sqlcipher_flutter_libs` 0.6.8 (`sqlcipher-android 4.10.0`; iOS/macOS use SQLCipher via `DynamicLibrary.process()`), key is a 32-byte random hex from `Random.secure()` stored in `FlutterSecureStorage` (`bayan.db.key.v1`), applied as `PRAGMA key = "x'<hex>'"` in `db_security.dart`; legacy plaintext DB detected by `SQLite format 3\0` header and migrated (`bayan_rep.sqlite.legacy` + fresh encrypted DB). Tokens moved from prefs to `flutter_secure_storage` 10.3.1 (`bayan.session.token.v1`/`refresh.v1`) with legacy-prefs migration in `session_store.init()`. Was: plaintext `SharedPreferences` tokens + unencrypted `NativeDatabase`. Host-verified (analyze clean, 181 tests); APK debug build confirms `libsqlcipher.so` packaged for all ABIs; real cipher path needs on-device test.
- **G6** `FIXED` — **Tenant isolation enforced via Postgres RLS.** Migration `20261012000000_rls_tenant_isolation` enables + forces RLS on 41 business tables (schema `bayan`, policy `tenant_isolation` equality on `companyId`, `FORCE` since `bayan` owns the tables), backed by GUC `app.current_company_id` set per request (ALS `runWithTenant` + global interceptor/auth guard) and per Prisma operation (`tenantRlsExtension` wraps every model op in a GUC transaction so `include` relations resolve; `$transaction` array/function forms inject the GUC manually). Closed-by-default: unset GUC returns 0 rows; inserts without it fail WITH CHECK. Live-verified: reads/list/create/delete all company-scoped (11 OK) and full golden suite at baseline parity (90 OK / 0 FAIL). Exempt: `User`, `CompanyFeature` (read pre-GUC), auth/catalog/unit/child-no-companyId tables. Was: `apps/api/src/common/tenant.ts:4` (app-level only).

### Medium

- `G7` `FIXED` — §5.3 pricing rules: added a per-item **min-sale-price floor** (`Item.minSalePrice`, base unit, scaled by the sale-unit factor); below it (or below last cost) the statement is held with a `BELOW_MIN_PRICE`/`BELOW_COST` approval and a `pricingAlerts` array is returned (**below-price alert**). **percent↔value discount conversion** added to `shared` (`convertDiscount`/`discountToPercent`/`discountToAmount`) and used for **type-agnostic discount-limit checks** (an amount discount is converted to its equivalent % and compared to the user limit); fixed the DTO `@Max(100)` that wrongly capped amount discounts. `Item.minSalePrice` wired through items create/update. (`price-statements.service.ts`, `packages/shared/src/discount.ts`)
- `G8` `FIXED` — §5.7 draft/held-statement stock reservation: a statement held as `PENDING_REVIEW` now **holds its stock** via a reservation. `SalesOpsService.holdForReview` reverses the posting (restock + reversing ledger credit) when the statement had been auto-approved, then reserves its quantities and sets `PENDING_REVIEW` (drafts already reserved by the approval flow are not double-reserved; paid statements are refused like cancel). `SyncService.pushPriceStatement` uses it on a net mismatch, and best-effort holds any statement created before a failed finalize. `cancel()` already releases the hold. Also mapped `BELOW_MIN_PRICE` → `discount.approve` in `ApprovalsService.TYPE_PERMISSION` (the G7 approval type was undecidable). (`sales-ops.service.ts`, `sync.service.ts`, `approvals.service.ts`)
- `G9` `FIXED` — §5.9 return **settlement semantics** now enforced end-to-end: `return.cash_refund` (defined in the §4.2 matrix but previously unused) is required to create/approve/finalize a `CASH` return (`ReturnsService.create`, `ApprovalsService.decide`→`assertDecidable`, `SalesOpsService.finalizeReturn`); `settlement` (`BALANCE`/`CASH`/`CREDIT`) is validated on the direct **and** sync paths (`SyncService.pushReturnStatement` was dropping it → mobile returns always became `BALANCE`); the `CASH` refund now posts the cash side via `ledger.cashEntry`. `BALANCE`/`CREDIT` credit the customer account (reduce balance / leave credit); `CASH` additionally debits the customer and credits the cash account (net-zero). (`returns.service.ts`, `approvals.service.ts`, `sales-ops.service.ts`, `sync.service.ts`)
- `G10` `FIXED` — §5.5 **landed-cost shipping apportionment** across purchase lines. `PurchasesService.create` now apportions the statement's shipping/extra expenses over the lines (shared `apportionLandedCost`, basis `VALUE` = line net / `QTY` = base qty, with QTY fallback when value basis is all-zero) and folds each line's share into `PurchaseStatementLine.landedCost`, the stock-in cost (`stock.purchaseIn`), and `Item.lastPurchaseCost`; sets `PurchaseStatement.landedCostTotal`. New DTO field `landedCostBasis` (`VALUE`|`QTY`, default `VALUE`) on `CreatePurchaseDto` + `ReceivePurchaseOrderDto` (forwarded through `PurchaseOrdersService.receive`). Shared `allocateProportional` extracted from `allocateHeaderDiscount`. Tests: `packages/shared/tests/statement.test.ts` (+7 → shared 96), `apps/api/tests/purchases.service.spec.ts` (4 → api 184). Was: line `landedCost` = line-net/base-qty with shipping excluded from cost/`lastPurchaseCost`; `receive` set `landedCostTotal` but never distributed it.
- `G11` `PARTIAL` — §5.14 / §12 **CSV-only export**; spec asks XLSX (and SQLite/Excel archive).
- `G12` `PARTIAL` — §5.2 **mixed-unit decomposition display** ("3 كرتونة + 2 عبوة") not surfaced.
- `G13` `MISSING` — §5.1/§9 mobile **barcode/QR scanning** (no scanner package in `apps/mobile/lib`).
- `G14` `PARTIAL` — §5.12 mobile per-line **unit + qty selection**.
- `G15` `PARTIAL` — §12.3/§12.4 **feature-flag UI hiding** on mobile (flags are evaluated but not used to hide UI).
- `G16` `MISSING` — §8.1 web **Settings screen**.
- `G17` `MISSING` — §12.3/§12.4 tenant-side **per-user / per-company feature-flag management** (web).
- `G18` `PARTIAL` — §5.16 **WhatsApp sharing** (API deep-link `wa.me` exists; web/mobile PDF-attach sharing absent).
- `G21` `FIXED` — §4.2 **permission-cell mismatches**: removed `rep.track` from `SALES_REP` and `stocktake.view` from `REP_SUPERVISOR`; self geo-reporting split into a new `geo.report` permission (rep/supervisor keep their own shift/location/visit + mobile intact) while fleet-view endpoints stay on `rep.track`/`geo.fleet`. Matrix extracted to `apps/api/src/auth/role-permissions.ts` (single source) + §4.2 regression test. Seed now revokes known perms absent from the matrix. Was: `apps/api/prisma/seed.ts:123`.
- `G26` `MISSING` — §9 **Hijri dates + Arabic-Indic numerals** not implemented in web/mobile.

### Low

- `G12b`/`G19` — Items lack **images / variants / QR-barcode labels** in web UI (§5.1); model fields exist.
- `G20` — Stocktakes lack category/brand scoping.
- `G22` `FIXED` — `helmet` added (`apps/api/src/main.ts`): full policies in production; CSP disabled in dev so Swagger UI keeps working.
- `G23` — Redis/BullMQ configured but unused (no background queues).
- `G24` — No `prisma migrate` check/guard on boot.
- `G25` — No 50k-row performance benchmark (§9).
- `G27` `FIXED` — §7.4 **stock-valuation equation** ported to `packages/shared` (`valuation.ts`: `calcStockLineValue`/`calcStockValue`/`weightedAverageCost`/`resolveUnitCost`, methods `LAST`/`WEIGHTED`/`SALES` mirroring `ReportsService.stockValues`) + Dart clone (`apps/mobile/lib/core/calc/valuation.dart`). Was server-only.
- `G28` — No Dockerfiles.
- `G29` — Print/PDF limited to statements (no A4/A5/80mm for other docs).

---

## 3. Accepted deviations & deferred-by-design (not defects)

- `users.device_id` → dedicated `DeviceRegistration` table; `price_statements.tax` → `taxPercent` + `taxAmount` (documented deviations).
- Paint/steel calculators live in **mobile** only (intentionally not in API).
- Quotations billing, electronic scale, tax-invoice integration, multi-branch, iOS client — deferred per `docs/PLAN.md` §4.
- FCM push (§5.15) — **blocked** on Firebase credentials; notifications are DB/in-app only today.

---

## 4. Remediation backlog (fix **one at a time**, commit per change)

Ordered so isolation/security land first, then correctness, then reporting, then UX parity, then infra. Each item is independently shippable with its own tests and a live `smoke`/`golden` re-run.

### Batch A — Security & isolation (do first)
1. **G1** Gate/mask quotation cost behind `cost.view`. ✅ **done**
2. **G21** Reconcile §4.2 permission cells + add a permission-matrix test. ✅ **done**
3. **G22** Add `helmet`. ✅ **done**
4. **G6** Tenant isolation: enforce non-null `companyId` on write paths + add RLS migration (+ regression tests). ✅ **done**
5. **G5** Mobile: encrypt Drift DB + move tokens to secure storage. ✅ **done**
6. **G4** Mobile: fail-loud device registration + remote device revoke + optional device lock. ✅ **done** (also server-enforced active device on sync)

### Batch B — Core correctness
7. ~~**G3** Record `StatementRevision` on edit-after-approval (+ audit + test).~~ ✅ done
8. ~~**G7** Min-sale-price floor, percent↔value conversion, below-price alert.~~ ✅ done
9. ~~**G8** Draft-level stock reservation.~~ ✅ done
10. ~~**G27** Stock-valuation equation parity in `shared` + Dart.~~ ✅ done
11. ~~**G9** Return mode/settlement semantics.~~ ✅ done
12. ~~**G10** Landed-cost shipping apportionment.~~ ✅ done

### Batch C — Reporting & exports
13. **G2** Add the missing §5.14 reports.
14. **G11** XLSX export engine (reuse across reports).
15. **G29** Print/PDF templates beyond statements.

### Batch D — Client parity (web + mobile)
16. **G13** Mobile barcode/QR scan.
15. **G14** Mobile per-line unit/qty picker.
16. **G15** Mobile feature-flag UI hiding.
17. **G16** Web Settings screen.
18. **G17** Tenant-side feature-flag management.
19. **G18** WhatsApp sharing with PDF.
17. **G19** Item images/variants/QR labels.  `G12` mixed-unit display. **G20** stocktake scoping.
18. **G26** Hijri + Arabic-Indic numerals (i18n).

### Batch D+ — Infra & ops
19. **G23** Background queues (Redis/BullMQ) for archive/notifications/reminders.
20. **G24** Boot-time migration check.
21. **G25** 50k performance benchmark.
22. **G28** Dockerfiles.

### Blocked
- **F2 / §5.15** FCM push — needs Firebase project + credentials.

---

## 5. Status log

| Date | Item | Result |
| ---- | ---- | ------ |
| 2026-10-12 | Gap analysis authored from 6 subagent reports | this document |
| 2026-10-12 | **G1** quotation cost masking | ✅ FIXED |
| 2026-10-12 | **G21** §4.2 permission-cell reconciliation (rep.track / stocktake.view + geo.report split) | ✅ FIXED |
| 2026-10-12 | **G22** `helmet` security headers | ✅ FIXED |
| 2026-10-12 | **G6** tenant isolation + Postgres RLS (41 tables, GUC `app.current_company_id`, extension wrap-all-ops) | ✅ FIXED (11/11 API verify, 90/90 golden parity) |
| 2026-10-12 | **G6** RLS regression: non-RLS child includes (`PriceStatementLine→statement`) returned null | ✅ fixed (wrap every model op, incl. their relations) |
| 2026-10-12 | **G5** mobile secrets at rest (SQLCipher + secure_storage) | ✅ FIXED (APK-build verified) |
| 2026-10-12 | **G4** mobile device trust (DeviceGuard + revoke/activate + biometric lock + header) | ✅ FIXED (17/17 live verify, api 153, mobile 190) |
| 2026-10-13 | **G3** edit-after-approval records `StatementRevision` + reverse/repost + audit | ✅ FIXED (9 tests; 25/25 live verify, 90/90 golden) |
| 2026-10-13 | **G7** min-sale-price floor + below-min-price alert + percent↔value conversion + type-agnostic discount limits | ✅ FIXED (5 new tests; 20/20 live verify, 90/90 golden) |
| 2026-10-13 | **G8** held-statement (`PENDING_REVIEW`) stock reservation + `BELOW_MIN_PRICE` approval permission mapping | ✅ FIXED (7 new tests) |
| 2026-10-13 | **G27** stock-valuation equation parity in `shared` + Dart (LAST/WEIGHTED/SALES) | ✅ FIXED (13 shared + 13 mobile tests) |
| 2026-10-13 | **G9** return settlement semantics: enforce `return.cash_refund`, carry `settlement` through sync, cash side via `ledger.cashEntry` | ✅ FIXED (6 new tests) |
