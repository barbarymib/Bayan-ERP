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
| G2 | **§5.14 reporting is skeletal.** Only 6 endpoints (stock values, movements, low-stock, stock summary, dashboard, aging). Missing sales / discounts / returns / stopped-customers / stocktake-diff / rep-performance / supplier-debt reports. Export is **CSV-only**; spec asks XLSX (+ PDF). | §5.14 | PARTIAL | `apps/api/src/reports/reports.controller.ts`; no `xlsx`/exceljs dependency in `apps/api/package.json`. **Progress:** export now CSV+XLSX (G11 done); added **sales** (`reports/sales-summary`, `reports/sales-by`) + **discounts** (`reports/discounts`, `reports/discount-approvals`) + **returns** (`reports/returns`, with return-to-sales ratio) + **stopped-customers** (`reports/stopped-customers`) + **stocktake-diff** (`reports/stocktake-diff`) + **supplier-debt** (`reports/supplier-debt`) + **rep-performance** (`reports/rep-performance`) — G2a–G2g done. Remaining: item-card, PDF (G29 covers print). |
- **G3** `FIXED` — **Statement revisions not recorded** on edit-after-approval. Added `PATCH /price-statements/:id` (`price-statements.controller.ts`) → `PriceStatementsService.update`: drafts/pending-review need `statement.edit`; an **approved** statement needs `statement.edit_approved`, then the prior state is snapshotted into `statement_revisions` (`revisionNo = max+1`) and the postings are **reversed** (`stock.restock` + customer-ledger credit) and **re-posted** with the new lines (`stock.saleOut` + debit) in one transaction, keeping status `APPROVED`; refused when `paid > 0` (mirrors cancel). Audited as `statement.edit` / `statement.edit_approved`; `GET /price-statements/:id` now returns `revisions`. Shared `resolveLines`/`buildLineRows`/`buildApprovals` extracted from `create`. Tests: `apps/api/tests/price-statements.service.spec.ts` (9). Was: `StatementRevision` written only by archive *restore* (`apps/api/src/archives/archives.service.ts:918`); no edit endpoint existed (drafts or approved). Spec §5.6 "نسخة معدلة… لا حذف مباشر" + §4.2 `statement.edit_approved`.
- **G4** `FIXED` — **Mobile device trust.** API: `DeviceGuard` (`apps/api/src/auth/device.guard.ts`) now enforces an active `x-device-id` on every `/sync` route except `device/register` (`@SkipDeviceCheck`); a revoked/unknown/missing device gets 403/400 so revoke cuts sync immediately (the guard pins the RLS tenant via `setTenant` since guards run before `TenantContextInterceptor` and Prisma resolves the GUC lazily at await). New `DevicesModule` exposes `GET /devices` + `POST /devices/:id/revoke|activate`, gated by a new `device.manage` permission (OWNER/REP_SUPERVISOR/ADMIN). Mobile: registration is now fail-loud (`auth_controller.dart` clears the token/session and surfaces the error), `ApiClient` sends `X-Device-Id` on every call, and a biometric gate (`device_lock_gate.dart`/`device_lock.dart` via `local_auth`, PIN/password fallback, toggle in the home menu) locks the app on cold start/resume. Web: `/devices` admin page (list + revoke/activate + nav). Verified live: `verify-g4-live.mjs` **17 OK / 0 FAIL** (401/403 auth, 400 missing header, 403 unknown/inactive, 200 active, revoke→403 instantly, activate→200); api 153 tests, mobile 190. Was: registration failure swallowed, no remote revoke, no device lock. (§9)
- **G5** `FIXED` — **Mobile secrets at rest:** Drift DB opened encrypted via `sqlcipher_flutter_libs` 0.6.8 (`sqlcipher-android 4.10.0`; iOS/macOS use SQLCipher via `DynamicLibrary.process()`), key is a 32-byte random hex from `Random.secure()` stored in `FlutterSecureStorage` (`bayan.db.key.v1`), applied as `PRAGMA key = "x'<hex>'"` in `db_security.dart`; legacy plaintext DB detected by `SQLite format 3\0` header and migrated (`bayan_rep.sqlite.legacy` + fresh encrypted DB). Tokens moved from prefs to `flutter_secure_storage` 10.3.1 (`bayan.session.token.v1`/`refresh.v1`) with legacy-prefs migration in `session_store.init()`. Was: plaintext `SharedPreferences` tokens + unencrypted `NativeDatabase`. Host-verified (analyze clean, 181 tests); APK debug build confirms `libsqlcipher.so` packaged for all ABIs; real cipher path needs on-device test.
- **G6** `FIXED` — **Tenant isolation enforced via Postgres RLS.** Migration `20261012000000_rls_tenant_isolation` enables + forces RLS on 41 business tables (schema `bayan`, policy `tenant_isolation` equality on `companyId`, `FORCE` since `bayan` owns the tables), backed by GUC `app.current_company_id` set per request (ALS `runWithTenant` + global interceptor/auth guard) and per Prisma operation (`tenantRlsExtension` wraps every model op in a GUC transaction so `include` relations resolve; `$transaction` array/function forms inject the GUC manually). Closed-by-default: unset GUC returns 0 rows; inserts without it fail WITH CHECK. Live-verified: reads/list/create/delete all company-scoped (11 OK) and full golden suite at baseline parity (90 OK / 0 FAIL). Exempt: `User`, `CompanyFeature` (read pre-GUC), auth/catalog/unit/child-no-companyId tables. Was: `apps/api/src/common/tenant.ts:4` (app-level only).

### Medium

- `G7` `FIXED` — §5.3 pricing rules: added a per-item **min-sale-price floor** (`Item.minSalePrice`, base unit, scaled by the sale-unit factor); below it (or below last cost) the statement is held with a `BELOW_MIN_PRICE`/`BELOW_COST` approval and a `pricingAlerts` array is returned (**below-price alert**). **percent↔value discount conversion** added to `shared` (`convertDiscount`/`discountToPercent`/`discountToAmount`) and used for **type-agnostic discount-limit checks** (an amount discount is converted to its equivalent % and compared to the user limit); fixed the DTO `@Max(100)` that wrongly capped amount discounts. `Item.minSalePrice` wired through items create/update. (`price-statements.service.ts`, `packages/shared/src/discount.ts`)
- `G8` `FIXED` — §5.7 draft/held-statement stock reservation: a statement held as `PENDING_REVIEW` now **holds its stock** via a reservation. `SalesOpsService.holdForReview` reverses the posting (restock + reversing ledger credit) when the statement had been auto-approved, then reserves its quantities and sets `PENDING_REVIEW` (drafts already reserved by the approval flow are not double-reserved; paid statements are refused like cancel). `SyncService.pushPriceStatement` uses it on a net mismatch, and best-effort holds any statement created before a failed finalize. `cancel()` already releases the hold. Also mapped `BELOW_MIN_PRICE` → `discount.approve` in `ApprovalsService.TYPE_PERMISSION` (the G7 approval type was undecidable). (`sales-ops.service.ts`, `sync.service.ts`, `approvals.service.ts`)
- `G9` `FIXED` — §5.9 return **settlement semantics** now enforced end-to-end: `return.cash_refund` (defined in the §4.2 matrix but previously unused) is required to create/approve/finalize a `CASH` return (`ReturnsService.create`, `ApprovalsService.decide`→`assertDecidable`, `SalesOpsService.finalizeReturn`); `settlement` (`BALANCE`/`CASH`/`CREDIT`) is validated on the direct **and** sync paths (`SyncService.pushReturnStatement` was dropping it → mobile returns always became `BALANCE`); the `CASH` refund now posts the cash side via `ledger.cashEntry`. `BALANCE`/`CREDIT` credit the customer account (reduce balance / leave credit); `CASH` additionally debits the customer and credits the cash account (net-zero). (`returns.service.ts`, `approvals.service.ts`, `sales-ops.service.ts`, `sync.service.ts`)
- `G10` `FIXED` — §5.5 **landed-cost shipping apportionment** across purchase lines. `PurchasesService.create` now apportions the statement's shipping/extra expenses over the lines (shared `apportionLandedCost`, basis `VALUE` = line net / `QTY` = base qty, with QTY fallback when value basis is all-zero) and folds each line's share into `PurchaseStatementLine.landedCost`, the stock-in cost (`stock.purchaseIn`), and `Item.lastPurchaseCost`; sets `PurchaseStatement.landedCostTotal`. New DTO field `landedCostBasis` (`VALUE`|`QTY`, default `VALUE`) on `CreatePurchaseDto` + `ReceivePurchaseOrderDto` (forwarded through `PurchaseOrdersService.receive`). Shared `allocateProportional` extracted from `allocateHeaderDiscount`. Tests: `packages/shared/tests/statement.test.ts` (+7 → shared 96), `apps/api/tests/purchases.service.spec.ts` (4 → api 184). Was: line `landedCost` = line-net/base-qty with shipping excluded from cost/`lastPurchaseCost`; `receive` set `landedCostTotal` but never distributed it.
- `G11` `FIXED` — §5.14 / §12 **XLSX export**. Added a dependency-free OOXML writer (`apps/api/src/common/xlsx.ts`, `toXlsx`/`recordsToSheet`, RTL sheets, inline-string + numeric cells) built on the existing hand-rolled ZIP primitives (moved to `apps/api/src/common/zip.ts`, `archives/zip.ts` re-exports them). Reports now honour `format=xlsx` alongside `format=csv` in `ReportsController.respond` (returns a `StreamableFile` with the spreadsheet content-type) for `stock-values`/`movements`/`stock-summary`. Archive bundles (`ArchivesService.exportBundle`) now include a per-table `${table}.xlsx` next to the JSON/CSV (§5.11 "Excel per type"). Chose a self-contained writer over the spec-named ExcelJS because the server deploy runs no `pnpm install`; zero new runtime deps. Tests: `apps/api/tests/xlsx.spec.ts` (10 → api 194).
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
- `G29` — Print/PDF limited to statements (no A4/A5/80mm for other docs). **Progress:** quotations now have a web print view (`/quotations/[id]/print`, A4/A5/80mm) + client PDF (`lib/quotation-pdf.ts`) — increment 1. Remaining: purchase orders, receipts/collections, transfers, returns, supplier-returns, stocktakes, daily-close, etc. (web + mobile).

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
13. **G2** Add the missing §5.14 reports. **G2a** sales ✅ · **G2b** discounts ✅ · **G2c** returns ✅ · **G2d** stopped-customers ✅ · **G2e** stocktake-diff ✅ · **G2f** rep-performance ✅ · **G2g** supplier-debt ✅ · **item-card** ✅. Next: PDF (G29).
14. ~~**G11** XLSX export engine (reuse across reports).~~ ✅ done
15. **G29** Print/PDF templates beyond statements. **Quotations ✅ (web print + PDF, increment 1)** · remaining: purchase orders, receipts/collections, transfers, returns, supplier-returns, stocktakes, daily-close (web + mobile).

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
| 2026-10-13 | **G10** landed-cost shipping apportionment (VALUE/QTY basis) | ✅ FIXED (7 shared + 4 api tests; 12/12 live verify, 90/90 golden) |
| 2026-10-13 | **G11** dependency-free XLSX export engine for reports + archives | ✅ FIXED (10 tests; 12/12 live verify, 90/90 golden) |
| 2026-10-13 | **G2a/G2b** sales reports (`reports/sales-summary`, `reports/sales-by`) + discounts (`reports/discounts`, `reports/discount-approvals`), profit gated by `cost.view` | ✅ FIXED (13 tests; 26/26 live verify, 90/90 golden) |
| 2026-10-13 | **G2c** returns report (`reports/returns`) by customer/rep/reason/item + return-to-sales ratio | ✅ FIXED (7 tests; 23/23 live verify, 90/90 golden) |
| 2026-10-13 | **G2d** stopped-customers report (`reports/stopped-customers?days=N`) | ✅ FIXED (5 tests; 14/14 live verify, 90/90 golden) |
| 2026-10-13 | **G2e** stocktake-difference report (`reports/stocktake-diff`) with surplus/shortage value | ✅ FIXED (6 tests; 26/26 live verify, 90/90 golden) |
| 2026-10-13 | **G2g** supplier-debt report (`reports/supplier-debt`) = opening + purchases − paid | ✅ FIXED (4 tests; 27/27 live verify, 90/90 golden) |
| 2026-10-13 | **G2f** rep-performance report (`reports/rep-performance`) = targets/achievement, sales, collection, visits, GPS distance | ✅ FIXED (7 tests; 21/21 live verify, 90/90 golden) |
| 2026-10-13 | **Item Card (G2)** `reports/item-card` = item ledger (opening + movements + running + closing + balances) with cost gating | ✅ FIXED (5 tests; 23/23 live verify, 90/90 golden) |
| 2026-10-15 | **G29 increment 1** printable quotation on web (`/quotations/[id]/print`, A4/A5/80mm) + Arabic client PDF (`lib/quotation-pdf.ts`) | ✅ PARTIAL (web build/typecheck/lint 0; deployed; live 200/307 parity) |
| 2026-10-16 | **Round 3 full spec re-audit** (6 parallel area reviews + direct verification) | this section |
| 2026-10-16 | **R3-A1** tenant user provisioning/listing scoped to company (+`companyId` persisted on create, seed backfill, regression test) | ✅ FIXED (6 new tests, api 247/247; 11/11 live verify) |
| 2026-10-16 | **R3-B1** credit-limit **warn/block** setting (`credit.limit.enforce`) enforced at create + approval + finalize | ✅ FIXED (9 new tests, api 256/256; 8/8 live verify) |
| 2026-10-16 | **R3-A2** per-role discount limits (fallback to user) | ✅ FIXED (api 280/280; 22/22 live verify) |
| 2026-10-16 | **R3-A4** decimal/integer measurement enforcement at line entry (shared + api + clients) | ✅ FIXED (api 283/283; mobile 223/223; 11/11 live verify) |
| 2026-10-16 | **R3-A7** scheduled prices (multi-row valid_from/valid_to + resolver + web input) | ✅ FIXED (api 287/287; 17/17 live verify) |
| 2026-10-16 | **R3-A9** rep "عملاؤه" customer scoping on statements/returns | ✅ FIXED (api 292/292; 11/11 live verify) |
| 2026-10-16 | **R3-B6/E1** audit coverage (statement.create, purchase.create, sync.push, master-data CRUD) | ✅ FIXED (api 292/292; 27/27 live verify) |
| 2026-10-16 | **Bug (found during R3-E1 verify):** array-form `prisma.$transaction([...])` on extended delegates **hangs forever** (nested self-wrapping transactions); broke every delete-guard endpoint (branches/categories/price-lists/special-prices/units/users/warehouses) | ✅ FIXED — converted to interactive `$transaction(async tx => ...)` (commit `4749f08`; api 292/292; live delete 200 + audit row) |
| 2026-10-16 | **R3-B11** re-check available stock at approval/finalize on `stock.sale.enforce=BLOCK`, excluding the statement's own reservation | ✅ FIXED (api 300/300; 15/15 live verify — approve blocked 400 + approval stays PENDING when balance drops; approve succeeds only once available-excluding-self ≥ qty) |
| 2026-10-16 | **R3-A5** item `Batch` registry (code + production/expiry dates) + capture on purchase receive + web batch UI | ✅ FIXED (api 309/309; web build/typecheck/lint 0; 29/29 live verify) |
| 2026-10-16 | **R3-A6** steel **actual-weight note** on statement lines (persist + STEEL-only) + `weight-notes` report + web/mobile capture | ✅ FIXED (api 314/314; web build/typecheck/lint 0; mobile analyze/tests 223/223; 27/27 live verify) |
| 2026-10-16 | **R3-C2/E5** valuation **no-price** flag/exclusion (+counts) + **items-without-price** report/tab | ✅ FIXED (api 319/319; web build/typecheck/lint 0; 31/31 live verify) |
| 2026-10-16 | **R3-C8** stocktake freeze **WARN** mode (BLOCK still enforced; WARN passes + surfaces `freezeWarning` on movement docs) | ✅ FIXED (api 323/323; web build/typecheck/lint 0; 31/31 live verify) |
| 2026-10-16 | **R3-C6/C5** stocktake **scope UI** (full/category/brand/item) + **multi-counter** attribution (`counter`/`countedById`) | ✅ FIXED (api 329/329; web build/typecheck/lint 0; 44/44 live verify) |
| 2026-10-16 | **R3-C7** stocktake **big-diff recount threshold/flagging** (value/qty thresholds, WARN/BLOCK gate on approve) | ✅ FIXED (shared 106/106; api 334/334; web build/typecheck/lint 0; 27/27 live verify) |
| 2026-10-16 | **R3-C4** rep-return **approval as per-company setting** (`return.rep.approval.required`) | ✅ FIXED (api 339/339; 17/17 live verify) |
| 2026-10-16 | **R3-C9** rep **custody-delivery report (محضر تسليم عهدة) + reconciliation** (`GET /treasury/handovers/:id`, `GET /treasury/custody-reconciliation`) | ✅ FIXED (api 345/345; web build/typecheck/lint 0; 31/31 live verify) |
| 2026-10-16 | **R3-C3** return **financial effect (settlement BALANCE/CASH/CREDIT)** exposed in the returns UI | ✅ FIXED (web build/typecheck/lint 0; 8/8 live verify) |

---

## 6. Round 3 audit (2026-10-16)

Re-audit of the whole codebase (api/web/mobile/shared, infra) against `docs/bayan-design.md`. Findings below are **new or status changes** vs §2/§3 above; existing `G##` items not repeated unless a status changed. IDs are `R3-A/B/C/D/E/F-n` by area.

### 6.1 Verified OK this round (was unchecked / previously mis-called)
- **§5.13 geo tracking — fully implemented:** shift start/end + shift-only gating, location push, **150m** proximity with out-of-range reason (`geo.service.ts:7,159,170`), **route replay** with stops/visits (`geo.service.ts:262-297`; web `app/(app)/geo/page.tsx:42-201`), **distance / dwell / not-visited** report (`geo.service.ts:336-371`; web `geo/page.tsx:468-485`), **90-day auto-delete** (`geo.service.ts:9-41`), live map (`geo.service.ts` `liveMap`), `@Features('geotracking.fleet')`. Mobile: mandatory location gate (`core/geo/location_gate.dart`), shift-gated timer (`shift_controller.dart:163-173`). *(An early subagent report claiming geo missing was wrong — verified directly.)*
- **§5.16 targets/commissions — implemented:** `apps/api/src/rep-targets/*` (`commissionBase COLLECTED|SALES`, `commissionRate`, report + `recalculate`), web `app/(app)/targets/page.tsx`.
- **§5.16 special offers — implemented:** `apps/api/src/special-prices/*` + `customer-groups.controller.ts` (customer / group / price-list targeting), web `app/(app)/special-prices/page.tsx`.
- **§5.16 quotation→statement — implemented:** `POST /quotations/:id/convert` (`quotations.controller.ts:69-73`, `quotations.service.ts:251-314`).
- **§5.16 calculators — implemented (mobile):** `features/tools/paint_calculator_screen.dart`, `steel_calculator_screen.dart`.
- **§5.16/§9 encrypted daily backup — implemented:** scheduled encrypted (`backups.service.ts`).
- **§5.15 notifications — all 7 types defined** (`notifications.service.ts:8-15`) with `refreshAlerts` for low_stock/credit_limit/return_approval/archive_reminder/backup_reminder + discount_approval created on statement paths. FCM transport remains blocked (**F2**).
- **§5.14 reports —** sales-summary/sales-by/discounts/discount-approvals/returns/stopped/stocktake-diff/supplier-debt/rep-performance/item-card/stock-summary(with slow-moving flag)/movements/low-stock/aging/dashboard all present (`reports.controller.ts:31-187`).
- **§7.3 tables/fields, §7.4 equations, §14 worked examples — verified OK** (see Round-3 sub-report; all tables present, all equations mirrored TS/Dart, examples asserted in both).

### 6.2 New findings

#### High
| ID | Gap | Spec | Status | Evidence |
| -- | --- | ---- | ------ | -------- |
| R3-A1 | Tenant user provisioning/listing not company-scoped: `/users` create never persists `companyId` (new users get `null` → RLS-closed, see nothing); `list`/`findOne` unfiltered and `User` exempt from RLS → cross-tenant user listing. | §12.1/§12.2/§4.1 | ✅ FIXED (11/11 live verify) | `users.service.ts` now scopes `list`/`findOne`/`update`/`remove` via `tenantWhere(companyId)` and `create` persists `companyId`; controller passes `user.companyId`; seed backfills `user.companyId`. |
| R3-B1 | Credit-limit is **warn-only** — no `block` mode/setting and not re-checked at approval; spec requires "تنبيه أو منع … (بحسب الإعداد)". | §5.4 | ✅ FIXED (8/8 live verify) | `sales-ops.service.ts` new `assertCustomerCredit` reads `credit.limit.enforce` (`WARN` default / `BLOCK`) and throws `BadRequestException('تجاوز الحد الائتماني…')` when projected > limit; called from `finalizeStatement` + `approvals.assertDecidable` + `price-statements.create`; `checkCreditLimit` now returns `exceeded`; seed adds `credit.limit.enforce`; web `CreditWarning.exceeded` typed. |
| R3-B2 | PO line **discounts dropped on receive** → supplier statement net > PO net silently (discount accepted in DTO/UI but no columns). | §5.5 | ✅ FIXED (5 new tests, api 261/261; 11/12 live verify) | `prisma/schema.prisma`: PurchaseOrderLine added `lineDiscountType/Value/Amount`; migration 20261016000000_purchase_order_line_discount; `purchase-orders.service.create` persists line discounts; `receive` forwards `{type, value}` to purchases (maps DB PERCENT/AMOUNT→percent/amount); new `purchase-orders.service.spec.ts`; web already sends/renders. |
| R3-C1 | **Mobile stocktake entry absent** (web-only; no on-device counting; sync supports no stocktake op). Discovered during the fix: `WAREHOUSEKEEPER` (the role holding `stocktake.execute`) had no `sync.use`, so `/sync/push` was unreachable for the only role that counts stock. | §5.8.3 | ✅ FIXED (61/61 live verify; api 266/266; mobile 210/210) | API: `sync.dto.ts` enum + `sync.service.ts` `pushStocktake` (enforces `stocktake.execute`, requires `payload.sessionId`/`counts[]`, maps `qty ?? qtyBase`, returns `{status:'UPLOADED', serverId}`; any throw → `PENDING_REVIEW` + `sync_failed` notification), `sync.module.ts` imports `StocktakesModule`, `stocktakes.module.ts` re-exports the service. Mobile: new `features/stocktake/{stocktake_controller,stocktake_screen}.dart` (list + count screen, Decimal-as-string safe `_numOr`, meta cache `stocktake.*`, outbox merge via `outbox.updatePendingOfType`), `api_client.stocktakeSessions/stocktakeDetail`, `data_store.readMeta/writeMeta`, home menu entry gated on `stocktake.view`. Permissions: `role-permissions.ts` gives `WAREHOUSEKEEPER` `sync.use` (+ `role-matrix.spec.ts` regression test). Tests: `apps/api/tests/sync.service.spec.ts` (new, 4), `apps/mobile/test/stocktake/stocktake_controller_test.dart` (new, 7), `outbox_test.dart` +2. |
| R3-D1 | Mobile **no persistent foreground tracking indicator** (spec: "إشعار دائم لأندرويد"). | §5.13 | ✅ FIXED (50/50 live verify; api 271/271; mobile 220/220) | mobile: `core/geo/tracking_notification.dart` (`AndroidTrackingNotifier` foreground service, channel `bayan_tracking`, notif id 8013; `NoopTrackingNotifier`) driven by `core/geo/shift_controller.dart` (start/resume, update body per push, stop on end); `AndroidManifest.xml` adds `POST_NOTIFICATIONS` + `com.dexterous.flutterlocalnotifications.ForegroundService` (`foregroundServiceType="location"`); `pubspec.yaml` +`flutter_local_notifications 17.2.4` (+ `dependency_overrides: dbus: 0.8.0`); in-app banner `features/home/home_screen.dart`. |

#### Medium
| ID | Gap | Spec | Status | Evidence |
| -- | --- | ---- | ------ | -------- |
| R3-A2 | Per-**role** discount limits absent — limits only per user (`Role` has no limit cols). | §4.2 note | ✅ FIXED | `Role.maxItemDiscountPct/maxInvoiceDiscountPct` (nullable, migration `20261016020000_role_discount_limits`); `common/discount-limits.ts` `effectiveDiscountLimit` (role limit else user); wired in `auth.service.ts:75-76,` + `auth.guard.ts`; `PUT /roles/:id/limits` (`users.service.ts` `updateRoleLimits`, ADMIN-protected, audit `role.limits`); web roles modal + card. Live-verified 2026-10-16 (22/0). |
| R3-A3 | Feature flags **not applied on any client UI**; no client-facing flag endpoint (API `@Features` only). Refines G15/G16/G17. | §12.3 | MISSING (web) / PARTIAL (mobile) | `auth.guard.ts:99-131`; no flag codes consumed in `apps/web`/`apps/mobile/lib` |
| R3-A4 | Decimal-vs-integer measurement **never enforced** (`allowDecimal` check has zero production callers). | §5.2 | ✅ FIXED | `packages/shared/src/units.ts` `allowsDecimalByMeasurement`/`assertQtyAllowed` (+tests); `apps/api/src/common/units.ts` `assertLineQtyAllowed` (→ 400); enforced at line entry in `price-statements`, `purchases`, `quotations`, `returns`, `purchase-orders`, `supplier-returns` services; clients: web `lib/units.ts` + statements/purchases forms, mobile `core/calc/units.dart` mirror. Live-verified 2026-10-16 (11/0). |
| R3-A5 | Batch **expiry date** missing (batch supported, no expiry field). | §5.1 | ✅ FIXED | New `Batch` registry model (`companyId?`, `itemId`, `code`, `productionDate? @db.Date`, `expiry? @db.Date`, `notes?`, `active`, `@@unique([companyId,itemId,code])`; migration `20261016040000_batch_expiry`, public-qualified); `PurchaseStatementLine.batchId` persisted; new `batches/` module (`GET/POST/PATCH/DELETE /batches`, `item.manage` to write, expiry filter hides expired by default); `purchases.service.ts` resolves/validates `batchId`+`expiry` (batch only for `trackBatch` items → 400, expiry requires `batchId` → 400) and `upsertBatch` on receive; web `items/page.tsx` batch modal (list/add/patch-expiry/delete + status badges) + `purchases/page.tsx` per-line batch/expiry inputs. Commits `9a7eb66`. Live-verified 2026-10-16 (29/0). |
| R3-A6 | Steel **actual-weight note** field unused (no DTO/web/mobile) and no weight-difference report. | §5.2, §11 | ✅ FIXED | `StatementLineInputDto.weightNote?` (`@MaxLength(255)`); `price-statements.service.ts` `resolveLines` loads `item.category.code` and accepts the note only for `STEEL` (else 400 `ملاحظة الوزن الفعلي متاحة لأصناف الحديد فقط (§5.2)`; whitespace trimmed away), persisted on `PriceStatementLine` + snapshot; `sync.service.ts` delta items expose `categoryCode` + `pushPriceStatement` maps `weightNote`; new `GET /reports/weight-notes` (`report.view`, CSV) listing recorded notes (filters empty; status default not-CANCELLED); web statement line input (steel-only) + detail/print/PDF display, reports `weightnotes` tab; mobile `Items.categoryCode` (schema v2 + migration) → `ItemSummary.isSteel`, statement line field + sync payload. Commits `32c976d`. Live-verified 2026-10-16 (27/0). |
| R3-A7 | Scheduled price `validFrom` broken: one row per (item,unit,list) upsert overwrites in place → a future-dated price removes the current price; no validFrom input in web. | §5.3 | ✅ FIXED | `ItemPrice` unique `@@unique([itemId,unitId,priceListId])` dropped, index `[itemId,unitId,priceListId,validFrom]` added (migration `20261016030000_price_scheduled_validity`); `prices.service.ts` `setPrice` closes prior overlapping windows + inserts (was `upsertPrice`); `migration.service.ts` findFirst+update/create; `price-resolver.service.ts` already date-aware; web `prices/page.tsx` validFrom/validTo inputs. Live-verified 2026-10-16 (17/0). |
| R3-A8 | Below-cost/floor `pricingAlerts` returned by API but **never surfaced** in web/mobile. (G7 backend FIXED.) | §5.3 | PARTIAL | `price-statements.service.ts:161,251,655-660` |
| R3-A9 | Rep "عملاؤه" scoping **not enforced** on statements/returns (only `sync.delta` filters assigned customers). | §4.2 | ✅ FIXED | `common/customer-scope.ts` `isRepScoped` (role `SALES_REP`), `assignedCustomerIds`, `assertCustomerInScope` (403/404), `repCustomerFilter`; enforced in `price-statements.service.ts` create/get/update/cancel + `list` and `returns.service.ts` create/get/cancel + `list`; controllers pass `user`. Live-verified 2026-10-16 (11/0). |
| R3-A10 | Item master editing incomplete: `UpdateItemDto` has no `itemUnits`/`attributes`; web can't set brand/origin/minSalePrice/imageUrl, unit flags/barcode, variants. (extends G12b/G19) | §5.1/§5.2 | PARTIAL | `items.dto.ts:135-191`; `apps/web/app/(app)/items/page.tsx:278-297,357-393,472-479` |
| R3-B3 | Mobile push sends no `paymentTerm`/`paid` → all rep sales forced **CREDIT**; MIXED unusable; web statement form has no `paid` input. | §5.6 | PARTIAL | `sync.service.ts:349-354`; `new_statement_screen.dart:118-138`; `statements/page.tsx:286-296` |
| R3-B4 | GPS issuance location never captured/sent by any client (API accepts lat/lng). | §5.6 | PARTIAL | `price-statements.dto.ts:132-137`; not sent in web/mobile payloads |
| R3-B5 | Discount %↔value auto-conversion is server-only; equivalent value not shown during entry (web+mobile). | §5.6 | PARTIAL | `price-statements.service.ts:625-651`; `statements/page.tsx:340-351,414-428` |
| R3-B6 | Discount audit incomplete: no audit on statement create; edit logs net-only (no discount delta). | §5.6 | ✅ FIXED | `statement.create` audit added after finalize/approval (`price-statements.service.ts`); edit audit now logs discount delta before/after `{status,net,subtotal,discountType,discountValue,discountAmount}` + reason. Live-verified 2026-10-16 (with R3-E1, 27/0); commit `4f49855`. |
| R3-B7 | `paymentRating`/`paymentNotes` stored but never editable/displayed; `customer.rating` perm unused. | §5.4 | ✅ FIXED | `paymentRating`/`paymentNotes` added to create/update DTOs; dedicated `PATCH /customers/:id/rating` gated by `customer.rating` (`customers.controller.ts`, `customers.service.ts:rate()` + `customer.rate` audit); web shows rating badge/notes column + rating modal gated by `can(user,'customer.rating')` (`customers/page.tsx`, `lib/api.ts`). Tests +3 (`customers.service.spec.ts`). Live-verified 2026-10-17 (set 82 + audit row; WAREHOUSEKEEPER → 403); commit `347105f`. |
| R3-B8 | Customer→rep transfer **history** has no UI (only current rep editable). | §5.4 | PARTIAL | `customers.service.ts:104,159-177`; no UI in `customers/page.tsx` |
| R3-B9 | Supplier statement API exists but **no web page** calls it. | §5.5 | PARTIAL | `collections.controller.ts:87-96`; no call in web |
| R3-B10 | No setting to **disable auto last-purchase-cost update** on approval (always updates). | §5.5 | ✅ FIXED | `purchases.service.ts` now checks `purchase.auto_update_last_cost` setting (default true) via `getAutoUpdateLastCostSetting()`; when false/0/no, skips `Item.lastPurchaseCost` update on approval. Tests updated (`purchases.service.spec.ts` +3). |
| R3-B11 | Negative-stock **BLOCK not rechecked at approval/finalize** → balance can go negative after the draft/reserve window. | §5.6 | ✅ FIXED | `stock.service.ts` `availableQty`/`assertSalePermitted` gained optional `exclude?: ReservationExclude {refType,refId}` (adds `NOT:{refType,refId}` to the reservation aggregate so a statement's own reservation isn't double-counted); re-check on `stock.sale.enforce=BLOCK` added in `sales-ops.service.ts` `finalizeStatement` (after `assertCustomerCredit`) and in `approvals.service.ts` `assertDecidable` **before** the approval status flip (so a rejection leaves the approval PENDING). Commits `f3bdb25`, `275f408`. Live-verified 2026-10-16 (15/0). |
| R3-C2 | Valuation "no price" items are costed 0 and folded into totals — not flagged/excluded+counted. | §5.8 note | ✅ FIXED | `reports.service.ts` `stockValues` rows gain `noPrice` (LAST: `lastPurchaseCost==null`; WEIGHTED: no purchase rows; SALES: no active price-list price); no-price lines are counted (`totals.noPriceItems/noPriceLines/noPriceQtyBase/noPriceValue`) + listed (`noPriceItems[]`) and **excluded** from `byItem`/`byWarehouse`/totals. (`packages/shared/src/stocktake.ts` already counted `noCostLines` — mirror only, not consumed.) Commit `4f5f3cd`. Live-verified 2026-10-16 (31/0). |
| R3-C3 | Return financial effect (BALANCE/CASH/CREDIT) not exposed in any UI. | §5.9 | ✅ FIXED | API already supported it (`CreateReturnDto.settlement` default `BALANCE`; `finalizeReturn` credits the customer, and for `CASH` also refunds via `return_refund` + cash entry, gated by `return.cash_refund`). Web now exposes it: `lib/api.ts` `ReturnSettlement` + `ReturnStatementDoc.settlement/withoutStatement`; `returns/page.tsx` create modal adds an «الأثر المالي» selector (BALANCE/CREDIT always, CASH only when the user has `return.cash_refund`), the list shows an «الأثر المالي» column, and the detail modal shows the settlement + a «بدون بيان» badge. Commit `5a65534`. Live-verified 2026-10-16 (8/0). |
| R3-C4 | Rep-return **approval** is permission-gated, not an optional per-company **setting**. | §5.9.6 | ✅ FIXED | `returns.service.ts` `create()` now computes `fromRep = !!user.repCode`; a rep return needs approval only when the setting requires it (`needsApproval = fromRep ? !selfApproved && repApprovalRequired() : !selfApproved`). New private `repApprovalRequired()` reads `return.rep.approval.required` (`'false'` = off; missing/anything else = required). Non-rep returns unchanged. Seed adds `return.rep.approval.required='true'`. Commit `3126840`. Live-verified 2026-10-16 (17/0). |
| R3-C5 | Multiple **counters** unsupported (no counter identity on counts/lines). | §5.8.3 | ✅ FIXED | `StocktakeLine` gains `counter String?` + `countedById Int?` (FK→`User`, `onDelete: SET NULL`; relation `StocktakeCountedBy`) via migration `20261016050000_stocktake_counters` (**schema-qualified `public.`**). `StocktakeCountInputDto` accepts optional `counter` (`@MaxLength(50)`); `stocktakes.service.ts` `counts()` persists trimmed `counter` + `countedById=user.id` on create/update (update keeps prior counter when omitted) and records distinct counters in the audit; `get()` returns `counter`/`countedBy`. Web `stocktakes/page.tsx` DetailModal has a counter input + «العداد»/«أدخل بواسطة» columns. Commit `a997148`. Live-verified 2026-10-16 (44/0). |
| R3-C6 | Stocktake scope: **item-group** missing; web open UI exposes no scope (extends G20). | §5.8.1 | ✅ FIXED | Server scope already supported `itemIds`/`categoryIds`/`brandIds`; "item-group" interpreted as explicit **item selection** (`itemIds`) since no `ItemGroup` model exists. Web OpenModal now offers scope = full / category / brand / item (multi-select from `/categories`, `/brands`, `/items?limit=500`, client-side search) and sends `scope` (requires ≥1 selection for partial modes). Commit `a997148`. Live-verified 2026-10-16 (44/0). |
| R3-C7 | Stocktake "big diff" **recount threshold/flagging** missing (manual transitions only). | §5.8.5/§6.3 | ✅ FIXED | Shared: `StocktakeRecountThreshold` + `isBigDiff(diffQty,diffValue,threshold)` (value/qty, each disabled at 0) + `StocktakeSummary.bigDiffLines/bigDiffQty/bigDiffValue`; `summarizeStocktake(lines, threshold?)`. API: settings `stocktake.recount.enforce` (`WARN`|`BLOCK`), `stocktake.recount.threshold` + `stocktake.recount.qtyThreshold` (0 = off; missing key → off/WARN); `get()` flags each line `bigDiff` + returns `recount{mode,thresholdValue,thresholdQty}`; `approve(dto.confirm?)` under `BLOCK` rejects big-diff sessions (400, mentions فرق) unless `confirm:true`, else warns via `recountWarning`. Web: amber big-diff banner, «فرق كبير» line badge, confirm checkbox on approve. Commit `1a2809d`. Live-verified 2026-10-16 (27/0). |
| R3-C8 | Freeze **WARN** mode is a no-op (only BLOCK enforced). | §5.8.2 | ✅ FIXED | `stock.service.ts` `assertMovable` now returns a `FreezeStatus` (`mode`/`frozen`/`sessionNumber`) + new `freezeStatus()`/`freezeWarningMessage()`; throws only on `BLOCK`, passes + warns on `WARN` (reads `stocktake.freeze.mode`, `OFF` disables). Movement-create docs (`price-statements`, `purchases`, `transfers`, `supplier-returns`) attach `freezeWarning` to their create responses; web shows it in the save toast. Commit `d1a5abc`. Live-verified 2026-10-16 (31/0). |
| R3-C9 | Rep **custody-delivery report (محضر تسليم عهدة) + reconciliation** absent (record only). | §5.10 | ✅ FIXED | API `treasury.service.ts` `getHandover(id)` (محضر detail: rep/receiver/cashAccount) + `custodyReconciliation(query)` (rep collections vs treasury handovers → `outstanding`) + routes `GET /treasury/handovers/:id` and `GET /treasury/custody-reconciliation?repId=&from=&to=` (`treasury.view`). Attribution follows the codebase convention `customer.repId` (see `reports.service.ts` `collectByRep`); receipts are attributed to the rep of their customer. Web `treasury/page.tsx`: reconciliation panel (collected/delivered/outstanding + receipts/handovers lists) + printable محضر modal (`window.print()`). Commit `37e2588`. Live-verified 2026-10-16 (31/0). |
| R3-D2 | No signed **consent/notice** for geotracking (§5.13/§9, Egypt 151/2020). | §5.13 | ✅ FIXED (50/50 live verify; api 271/271; mobile 220/220) | API: `ConsentRecord` model + migration `20261016010000_geo_consent` (**schema-qualified `public.`** — see note), `geo.service.ts` `consentStatus/acceptConsent/revokeConsent/assertGeoConsent` (setting `geo.consent.required`, default true; `ForbiddenException` 403 on `startShift` without current-version consent; revoke ends active shift), routes `GET/POST /geo/consent` + `POST /geo/consent/revoke`; mobile: `core/geo/tracking_consent.dart`, `features/geo/consent_screen.dart` gating shift start. |
| R3-D3 | Tracking interval hardcoded 60s Provider — not user-configurable. | §5.13 | PARTIAL | `providers.dart:39`; `shift_controller.dart:72` |
| R3-D4 | No idle **battery throttling** of location pushes. | §5.13 | MISSING | `shift_controller.dart:163-173` (fixed timer) |
| R3-E1 | Audit rows not on **every** sensitive op: no audit on statement.create / purchase.create / sync push / master-data CRUD (items/customers/suppliers/warehouses). | §9 | ✅ FIXED | `purchase.create` (entity `PurchaseStatement`) in `purchases.service.ts`; `sync.push` (entity `SyncPush`, only when `serverId` present) in `sync.service.ts`; `item.create/update` (+delete via 2nd `item.update`), `customer/supplier/warehouse.create/update/delete` — services take `AuditLogsService` + optional `userId`, controllers pass `user.id`. Live-verified 2026-10-16 (27/0); commit `4f49855`. |
| R3-E2 | **No backup before data migration** (`migration.import` runs without a dump; only archive run backs up). | §9 | ✅ FIXED | `MigrationService.importPayload` now calls `BackupsService.runBackup(userId)` before importing (skipped in test env; opt-out via `LegacyImportDto.skipBackup`); returns/audits `backupCode`. `BackupsModule` exports `BackupsService`; `MigrationModule` imports it. Tests +2. Live-verified 2026-10-17 (no-op import → `backupCode BK-20261018010530-566a43`, `total 0`). Commit `c2437b2`. |
| R3-E3 | Server-side **sensitive-data encryption** absent (only backup AES + mobile SQLCipher). | §9 | ✅ DOCUMENTED | ADR-0015 (`docs/adr/0015-data-at-rest-encryption.md`): disk/volume encryption (LUKS/cloud) recommended + verification; backups always AES-256-GCM; `bayan_backup` BYPASSRLS role for `pg_dump`; optional pgcrypto noted. Enablement is an ops step per environment. |
| R3-E2b | **Daily/scheduled encrypted backups FAILED silently since RLS (2026-10-13)** — `pg_dump` aborts on `FORCE ROW LEVEL SECURITY` tables as the non-bypass `bayan` role. | §9 | ✅ FIXED | `resolveDumpDatabaseUrl()` prefers `BACKUP_DATABASE_URL` (dedicated `bayan_backup` role with `BYPASSRLS` + `pg_read_all_data`) over `DATABASE_URL`; server role + env created. Tests +3 (`backups-crypto.spec.ts`). Live-verified 2026-10-17: backup `BK-20261018010530-566a43` `DONE` (268 KB) + `/verify` `ok:true`. Commit `4150210`. |
| R3-E4 | No **stale-draft warning** for old price statements. | §11 | ✅ FIXED | API `price-statements.service.ts`: exported `isDraftStatementStatus`/`statementAgeDays`/`computeStaleDraft` + setting `statement.stale_draft_days` (default 3); `list`/`get` now return `ageDays`/`isStaleDraft`/`staleDraftDays`. Web `statements/page.tsx`: amber banner + per-row `مسودة قديمة N يوم` badge + detail-modal warning. Mobile `my_statements_view.dart` `isStaleDraft`/`staleDraftCount` + banner + chip. Tests: api +7 (402/402), mobile +5. Live-verified 2026-10-17 (threshold=1 flips drafts to `stale:true`; setting removed). Commit `cc3a666`. |
| R3-E5 | No **"items without price"** report/list (valuation silently 0). | §11 | ✅ FIXED | new `ReportsService.itemsWithoutPrice` (+ `QueryItemsWithoutPriceDto`) lists active items with `lastPurchaseCost==null` (on-hand qty via `stockBalance.groupBy`); `GET /reports/items-without-price` (`report.view`, CSV); web reports tab "أصناف بدون سعر". Commit `4f5f3cd`. Live-verified 2026-10-16 (31/0). |
| R3-F1 | Mobile **no "my customers" screen** (search+filter+distance). | §8.2 #2 | MISSING | no `features/customers/**`; inline list `home_screen.dart:216-226` |
| R3-F2 | Mobile items screen **omits stock balances**. | §8.2 #7 | PARTIAL | `catalog/catalog_screen.dart`; `ItemSummary` no qty `models.dart:94-116` |
| R3-F3 | Mobile home **lacks today KPIs**. | §8.2 #1 | PARTIAL | `home/home_screen.dart` |

#### Low
| ID | Gap | Spec | Status | Evidence |
| -- | --- | ---- | ------ | -------- |
| R3-A11 | No `lastPurchaseAt` date stored (only cost). | §5.3 | PARTIAL | `schema.prisma:396` |
| R3-A12 | `printing.retail` flag seeded but never enforced. | §12.3 | PARTIAL | `seed.ts:63`; `@Features` uses exclude it |
| R3-A13 | Currency not modeled (EGP hardcoded). | §3 | PARTIAL | `apps/web/lib/tafqit.ts:94` |
| R3-A14 | Web shows wrong "own" discount limits (`roleCode==='ADMIN'?100:0`). | §4.2 | DEVIATION | `apps/web/app/(app)/users/page.tsx:84` |
| R3-B12 | `creditDays` captured but unused (no due-date/overdue). | §5.4 | PARTIAL | `customers.dto.ts:84,158` |
| R3-B13 | Customer map location: API lat/lng exists, no web input/picker. | §5.4 | MISSING | `customers/page.tsx` |
| R3-B14 | No dedicated `statement.cancel` permission (gated by `statement.edit`). | §5.6 | DEVIATION | `price-statements.controller.ts:63-64` |
| R3-B15 | Tax is per-statement, not a company setting. | §5.6 | DEVIATION | `price-statements.dto.ts:104` |
| R3-C10 | Archive delete lacks explicit "bundle saved" confirmation step. | §5.11.5-6 | ✅ FIXED | Deletion now requires an explicit "bundle saved" acknowledgment *and* the confirm word. API: `ArchiveConfirmDto` requires `bundleSaved: boolean` (+ optional `bundleLocation`) and `confirm()` takes it, rejecting `bundleSaved=false` («أقرّ أولًا بحفظ…») and absent/`null` `bundlePath` or a bundle missing from storage («غير موجودة في المخزن») before any deletion. Split `ArchiveRestoreDto` (confirmText only) so restore is unaffected. Web `archives/page.tsx`: the READY card adds a «تنزيل حزمة النسخ الاحتياطي» button, an «أقرّ بحفظ الحزمة» checkbox (gates the confirm button) and a «مكان حفظ الحزمة» field; the success notice echoes the location. Commit `956e648`. Live-verified 2026-10-17 (18/0). |
| R3-C11 | Archive bundle lacks combined-statement PDF + SQLite (JSON only). | §5.11.3 | ✅ FIXED | The bundle now ships a re-openable **`data.sqlite`** next to `data.json`/CSV/XLSX: `exportBundle` writes it via the dependency-free `recordsToSqlite` (`apps/api/src/common/sqlite.ts`, Node's built-in `node:sqlite` — no new runtime dep), one table per `ARCHIVE_TABLES` entry with inferred INTEGER/REAL/TEXT affinities, dates→ISO, booleans→0/1, objects→JSON, plus an `_archive_meta` key/value table (code/range/counts/totals). It is checksummed and listed in `manifest.files` like every other file. The §5.11.3 combined **PDF is explicitly *(اختياري)* optional** and remains out of scope (printable statement views already exist). Tests: `apps/api/tests/sqlite.spec.ts` (6 → api 357). Commit `e6a453c`. Live-verified 2026-10-17 (15/0: bundle zip contains `<code>/data.sqlite`, header valid, re-opened via sqlite3, `_archive_meta` matches, sha256/bytes match manifest). |
| R3-C12 | Archive verify re-matches only 6 counts + `salesNet`. | §5.11.4 | ✅ FIXED | `ArchivesService.verify` now re-matches **all 15** `ARCHIVE_TABLES` counts (with the exact export where-clauses, incl. relation filters `statement`/`return`/`session`/`receipt`/`statement` and the `receipt_allocations` OR) **and all 8** totals (salesNet, purchaseNet, returnsTotal, receiptsTotal, paymentsTotal, chequesTotal, ledgerDebit, ledgerCredit; ±0.01 tolerance), collecting every difference into one `detail`. Tests: `apps/api/tests/archives-verify.spec.ts` (6 → api 363). Commit `32f3b86`. Live-verified 2026-10-17 (23/0: empty-range `run`→`READY` executes all 15 count + 8 aggregate queries against the live schema; manifest exposes all 15 count keys + 8 total keys). |
| R3-C13 | Numbering lacks prefix+**year** / per-period reset (`BP-2027-000001`). | §5.11.8 | ✅ FIXED | `formatDocNumber` (shared) gained an optional `period` (non-zero → `BP-2027-000001` / `BP-M03-2027-000001`, else legacy). `NumberBlock` gained `period Int @default(0)` + unique `(companyId,prefix,ownerCode,period,fromNo)` + index `(prefix,ownerCode,period)` (migration `20261017000000_number_block_period`). `NumberingService.issue` reads setting **`numbering.period.mode`** (`'YEAR'` → current year, per-period block reset; else 0 = legacy). Enabled only when archiving starts new numbering: `ArchiveConfirmDto.startNewNumbering` → `confirm()` upserts the setting (audited, step 8) + web checkbox. Mobile `sync` blocks stay period-0 (offline numbering untouched). Tests: shared +4, `numbering.service.spec` +2 (→ api 365). Commit `3880d7e`. Live-verified 2026-10-17 (17/0: column+indexes applied, setting off by default, legacy `PO-000002`, `YEAR`→`PO-2026-000001`/`PO-2026-000002`, revert→`PO-000003`, DTO accepts `startNewNumbering`). |
| R3-C14 | Customer statement has no migrated-opening display + archive link. | §5.11 | ✅ FIXED | `customerStatement` (`collections.service.ts`) now returns `migratedOpening`: the latest `OpeningBalance` (kind `CUSTOMER`, `accountId`=customer, RLS-scoped) joined to its confirmed `ArchiveRun` (`amount`, `runId`, `runCode`, range, `confirmedAt`, `bundleAvailable` from `bundlePath`, `bundleSha256`) or `null`. Web `collections/page.tsx` «كشف حساب» shows an amber «رصيد افتتاحي مُرحّل من الأرشيف» card (amount + bundle code/range + «تنزيل حزمة الأرشيف» button reusing the token-auth bundle fetch + «عرض الأرشيف» link); `CustomerStatement` type gained the field. **Prerequisite bug found & fixed while live-verifying**: archive `confirm()` created its `Period`/`OpeningBalance`/`LedgerEntry` roll rows **without `companyId`**, which violated the RLS `WITH CHECK` and made confirm fail for the real `bayan` role (never exercised live before — only the guard-failure paths were tested). `confirm` now reads `currentCompanyId()` and stamps it on both `period.create` rows and every `rollLedger`/`rollOpeningBalances` row. Tests: `ledger.service.spec` +3 (migratedOpening), `archives-confirm.spec` +1 (companyId stamping). Commit `3215d3e` (RLS fix) + `a1cd694` (feature). Live-verified 2026-10-17 (15/0: real empty-range `run`→`READY`→`confirm`→`CONFIRMED`, 6 opening-balance rows all with `companyId=1`, ARCHIVED `Period` with `companyId=1`, `GET /customers/:id/statement` exposes matching `migratedOpening`, web `.next` contains `migratedOpening`; DB restored). |
| R3-C15 | `WALLET` lumps Vodafone-Cash/InstaPay. | §5.10 | ✅ FIXED | `PaymentMethod` now names both electronic wallets: `enum PaymentMethod` gained **`VODAFONE_CASH`** (فودافون كاش) and **`INSTAPAY`** (إنستاباي); legacy `WALLET` kept for backward compatibility (migration `20261017010000_payment_method_wallet_split`, `ALTER TYPE … ADD VALUE IF NOT EXISTS`). `collections.dto.ts` exposes one shared `PAYMENT_METHODS` const/type used by all three `method` fields (`CreateReceiptDto`/`QueryReceiptsDto`/`CreatePaymentDto`). Web `collections/page.tsx` `methodLabel` + both method `<Select>`s list the five spec methods; mobile `new_collection_screen.dart` dropdown gained تحويل/فودافون كاش/إنستاباي and `receipt.dart` `_methodLabel` gained both wallets (also fixed a latent `CHECK`→`CHEQUE` mismatch). `method` stays a label except `CHEQUE` (triggers cheque); electronic wallets are correctly excluded from `todayCashCollected` (which filters `CASH`). Tests: `payment-methods.spec.ts` (4 → api 373); mobile 223. Commit `5de5603`. Live-verified 2026-10-17 (13/0: enum has all 6 values, 29 migrations; `POST /receipts` accepts VODAFONE_CASH/INSTAPAY/WALLET and rejects an unknown method with 400; `GET /receipts?method=VODAFONE_CASH` filters; web `.next` contains `VODAFONE_CASH`; receipts+ledger+RC block cleaned/restored). |
| R3-C16 | Warehouse types lack STEEL/PAINT (MAIN/REP/DAMAGED/SHOWROOM only). | §5.7 | ✅ FIXED | `enum WarehouseType` gained **`STEEL`** (حديد) + **`PAINT`** (بويات) — the multi-type stores named by §5.7 («رئيسي، حديد، بويات، سيارات المناديب، معرض») — via migration `20261017020000_warehouse_type_steel_paint` (`ALTER TYPE … ADD VALUE IF NOT EXISTS`). `migration.dto.ts` `WAREHOUSE_TYPES` extended to all six. **Two latent bugs found & fixed on the web `warehouses/page.tsx`:** (1) its type dropdown offered non-existent `TRANSIT`/`BLIND` (create → 400) — now the real six values with Arabic labels + a `typeLabel` map for the badge; (2) `GET /warehouses?limit=…` returned 400 because `QueryWarehousesDto` had no `limit` (and neither did any other DTO allow it) — the web warehouses **and** quotations pages both call `/warehouses?limit=100`, so the warehouse pickers never loaded. `QueryWarehousesDto` now has `page`/`limit` (`@Type(Number)`) and `WarehousesService.list` applies `skip`/`take` (limit capped 100, default 20) returning `{warehouses,total,page,limit,pages}` (customers pattern). Tests: `warehouse-types.spec.ts` (2) + `warehouses.service.spec.ts` (3) → api 378. Commits `72caa9f` (types+web) + `bd94ba4` (pagination). Live-verified 2026-10-17 (15/0: enum has all 6, 30 migrations; `POST /warehouses` accepts STEEL/PAINT and rejects TRANSIT 400; `GET /warehouses?limit=100`→200 with `page/limit` echoed + row present; `?type=PAINT` filters; served `.next/static|server` has the Arabic labels and no stale `TRANSIT`; created rows cleaned). |
| R3-C17 | Return-without-statement self-approvable (no forced 2nd approver). | §5.9 | ✅ FIXED | **returns.service.ts:** when `withoutStatement` is true, forced `needsApproval = true` (overriding `return.rep.approval.required` and self-approval for users with `return.approve`); added `withoutStatement` to `refJson` and excluded requester from approval notifications. **approvals.service.ts:** when approving a RETURN, reject if `requestedById === user.id` (second approver required). Tests updated (`returns.service.spec.ts` now enforces mandatory approval for without-statement even if `return.approve` exists or setting is `false`; `approvals.service.spec.ts` blocks self-approval of RETURN). Commit `76ed1eb`. |
| R3-E6 | Periodic restore test is manual (decrypt/checksum only; no drill/restore). | §9 | PARTIAL | `backups.controller.ts:37`; `backups.service.ts:122-150` |
| R3-E7 | Mobile Drift DB has no secondary indexes. | §11 | MISSING | `apps/mobile/lib/core/db/database.dart` |
| R3-E8 | 50+ concurrent scalability untested (distinct from G25). | §9 | PARTIAL | `app.module.ts:51` only |
| R3-F4 | Mobile new statement has no payment step. | §8.2 #3 | PARTIAL | `new_statement_screen.dart:106-149` |
| R3-F5 | Mobile has no dedicated settings screen. | §8.2 #8 | PARTIAL | `home_screen.dart:97-141` |
| R3-F6 | Mobile "بياناتي" has no unified drafts/uploaded view. | §8.2 #4 | PARTIAL | `my_statements_screen.dart:21-31` |

---

## 7. Master remediation plan — fill **all** open gaps (incl. medium & low)

Ordering: security/data-integrity first, then correctness, then UI parity, then infra/i18n. Each item ships independently: code → api/web/mobile gates → commit → deploy → live-verify → status log update. Docs/UI-only items need no DB seed/migration.

### Phase P1 — Security & data integrity (High)
1. **R3-A1** tenant user provisioning/listing scope (+regression test). — ✅ FIXED (api 247/247; 11/11 live verify)
2. **R3-B1** credit-limit warn/block setting + enforce at approval + notify. — ✅ FIXED (api 256/256; 8/8 live verify)
3. **R3-B2** carry PO line discounts into receive/statement (schema migration + shared calc). — ✅ FIXED (api 261/261; 11/12 live verify — the 1 miss was cosmetic JSON number formatting)
4. **R3-C1** mobile stocktake entry + sync op (web parity already exists). — ✅ FIXED (api 266/266; mobile 210/210; 61/61 live verify)
5. **R3-D1/D2** mobile foreground tracking notification + signed consent notice. — ✅ FIXED (api 271/271; mobile 220/220; 50/50 live verify)

### Phase P2 — Core correctness (Medium, backend/shared)
6. **R3-A2** per-role discount limits (fallback to user) — schema + enforcement. — ✅ FIXED (api 280/280; web build clean; 22/22 live verify)
7. **R3-A4** decimal/integer enforcement at line entry (shared + api + clients). — ✅ FIXED (shared 99/99; api 283/283; web build clean; mobile 223/223; 11/11 live verify)
8. **R3-A7** scheduled prices (multi-row valid_from/valid_to + resolver + web input). — ✅ FIXED (api 287/287; web build clean; 17/17 live verify)
9. **R3-A5** item batch expiry (schema + item/purchase UI). — ✅ FIXED (api 309/309; web build clean; 29/29 live verify)
10. **R3-A6** steel actual-weight input + weight-difference report. — ✅ FIXED (api 314/314; web build clean; mobile 223/223; 27/27 live verify)
11. **R3-A9** enforce rep customer scoping on statements/returns. — ✅ FIXED (api 292/292; 11/11 live verify)
12. **R3-B11** re-check negative-stock/credit at approval/finalize. — ✅ FIXED (api 300/300; 15/15 live verify)
13. **R3-B6/E1** audit coverage: statement.create, purchase.create, sync push, master-data CRUD. — ✅ FIXED (api 292/292; 27/27 live verify)
14. **R3-C2/E5** valuation no-price flag/exclusion + "items without price" report. — ✅ FIXED (api 319/319; web build clean; 31/31 live verify)
15. **R3-C8** stocktake freeze WARN mode (surface warning). — ✅ FIXED (api 323/323; web build clean; 31/31 live verify)
16. **R3-C6/C5** stocktake scope (category/brand/group) + counters; web open-scope UI. — ✅ FIXED (api 329/329; web build clean; 44/44 live verify)
17. **R3-C7** recount threshold/flagging (shared + UI). - ✅ FIXED (shared 106/106; api 334/334; web build clean; 27/27 live verify)
18. **R3-C4** rep-return approval as a per-company setting. - ✅ FIXED (api 339/339; 17/17 live verify)
19. **R3-C9** custody-delivery report + reconciliation (api + print). - ✅ FIXED (api 345/345; web build clean; 31/31 live verify)
20. **R3-B10** setting to disable auto last-purchase-cost update. — ✅ FIXED (api 387/387; live verify commit `4c99fbb`)
21. **R3-E2** pre-migration backup ✅ FIXED (+ **R3-E2b** backup-under-RLS fix); **R3-E3** server at-rest encryption ✅ DOCUMENTED (ADR-0015).
22. **R3-E4** stale-draft warning for price statements. — ✅ FIXED (api 402/402; live verify commit `cc3a666`)
23. **R3-A8** surface `pricingAlerts` (web + mobile).
24. **R3-A10** item master editing (units/attributes/brand/origin/minSalePrice/image/variants).
25. **R3-B3** mobile payment term + paid amount (enable MIXED).
26. **R3-B4** capture/send statement GPS location from clients.
27. **R3-B5** live %↔value discount conversion in entry forms.
28. **R3-B7** customer payment rating/notes (dto + web) wired to `customer.rating`. — ✅ FIXED (api 390/390; web build clean; live verify commit `347105f`)
29. **R3-B8** customer rep-assignment transfer history UI.
30. **R3-B9** supplier statement web page.

### Phase P3 — Client parity & features (Medium/Low)
31. **G12** mixed-unit composite display ("3 كرتونة + 2 عبوة") in ui/api.
32. **G13** mobile barcode/QR scan (items+customers).
33. **G14** mobile per-line unit picker.
34. **G15/A3** feature-flag-driven UI hiding (mobile + web) + client flag endpoint.
35. **G16** web Settings screen.
36. **G17** tenant-side per-user/company feature-flag management (non-global-admin).
37. **G18** web WhatsApp/PDF share.
38. **R3-F1/F2/F3/F4/F5/F6** mobile screens: my-customers (search/filter/distance), item balances, home KPIs, payment step, settings screen, unified "بياناتي".
39. **G19** item images/variants/QR labels in web UI.
40. **R3-B12/B13/B14/B15** credit days usage, customer map picker, `statement.cancel` perm, tax setting.
41. **R3-A11/A12/A13/A14** last-purchase date, `printing.retail` gate, currency setting, fix users-page limits.
42. **R3-C10..C17** all C-series archive/numbering/migrated-opening/wallet/warehouse/return-approval items done (via C10–C17 commits). |
43. **G20** stocktake scoping UI (covered with R3-C6).
44. **G29** print/PDF templates for purchases, receipts, transfers, returns, supplier-returns, stocktakes, daily-close (web + mobile).

### Phase P4 — Infra, i18n & NFRs (Low/Medium)
45. **G23** BullMQ background queues (archive/notifications/reminders) — **R3-E6** restore-test job.
46. **G24** boot-time migration check.
47. **G25/R3-E8** 50k-item + 50-concurrent performance benchmark.
48. **G26** Hijri calendar + Arabic-Indic numerals.
49. **G28** Dockerfiles.
50. **R3-E7** mobile Drift indexes; **§7.2** queue component.

### Blocked
- **F2 / §5.15** FCM push transport — needs Firebase project + credentials (notification *records* already work).

### Migration note — schema `bayan`
The RLS migration (`20261012000000_rls_tenant_isolation`) does `CREATE SCHEMA IF NOT EXISTS bayan` and puts the helper `bayan.current_company_id()` there. Because the DB role is named `bayan`, its default `search_path` is `bayan, public`, so an **unqualified `CREATE TABLE` in any migration after RLS lands in schema `bayan`, not `public`** (where all 72 app tables live) → Prisma Client (which resolves via `public`) fails at runtime with `relation "…" does not exist`. **Rule: new-table migrations MUST schema-qualify `public."Table"` (and FKs `REFERENCES public."…"`).** Column-only (`ALTER TABLE`) migrations are unaffected.
