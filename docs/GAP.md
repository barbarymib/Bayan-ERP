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
- **G3** `MISSING` — **Statement revisions not recorded** on edit-after-approval. `StatementRevision` is written **only** by archive *restore* (`apps/api/src/archives/archives.service.ts:918`); the edit-after-approval flow never creates a revision. Spec §5.1 text + §4.2 row "تعديل بيان بعد الاعتماد".
- **G4** `PARTIAL` — **Mobile device trust.** Device registration failure is swallowed (`apps/mobile/lib/services/api_client.dart:123`); **no remote device revoke**, **no device-lock (biometric/PIN)**. (§9)
- **G5** `MISSING` — **Mobile secrets at rest:** auth/refresh tokens stored plaintext; Drift DB opened unencrypted (no `sqlcipher`/`NativeDatabase` encryption). (§9)
- **G6** `PARTIAL` — **Tenant isolation is app-level only.** `companyId` is nullable, many child tables carry no `companyId`, guards rely on `!= null` checks, and there is **no Postgres RLS**. `tenantWhere` at `apps/api/src/common/tenant.ts:4`. (§12, §9 security)

### Medium

- `G7` `PARTIAL` — §5.3 pricing rules: **min-sale-price floor** missing; **auto percent↔value discount conversion** missing; **below-price alert** only partially covered by a below-cost approval flag. (`price-statements.service.ts`)
- `G8` `PARTIAL` — §5 draft reservation occurs only when `requiresApproval`, not on every draft (`price-statements.service.ts:214`).
- `G9` `PARTIAL` — §5.9 return **mode/settlement semantics** (settle vs. credit) partial.
- `G10` `PARTIAL` — §5.5 **landed-cost shipping apportionment** across purchase lines absent.
- `G11` `PARTIAL` — §5.14 / §12 **CSV-only export**; spec asks XLSX (and SQLite/Excel archive).
- `G12` `PARTIAL` — §5.2 **mixed-unit decomposition display** ("3 كرتونة + 2 عبوة") not surfaced.
- `G13` `MISSING` — §5.1/§9 mobile **barcode/QR scanning** (no scanner package in `apps/mobile/lib`).
- `G14` `PARTIAL` — §5.12 mobile per-line **unit + qty selection**.
- `G15` `PARTIAL` — §12.3/§12.4 **feature-flag UI hiding** on mobile (flags are evaluated but not used to hide UI).
- `G16` `MISSING` — §8.1 web **Settings screen**.
- `G17` `MISSING` — §12.3/§12.4 tenant-side **per-user / per-company feature-flag management** (web).
- `G18` `PARTIAL` — §5.16 **WhatsApp sharing** (API deep-link `wa.me` exists; web/mobile PDF-attach sharing absent).
- `G21` `FIXED` — §4.2 **permission-cell mismatches**: removed `rep.track` from `SALES_REP` and `stocktake.view` from `REP_SUPERVISOR`; matrix extracted to `apps/api/src/auth/role-permissions.ts` (single source) + §4.2 regression test. Seed now revokes known perms absent from the matrix. Was: `apps/api/prisma/seed.ts:123`.
- `G26` `MISSING` — §9 **Hijri dates + Arabic-Indic numerals** not implemented in web/mobile.

### Low

- `G12b`/`G19` — Items lack **images / variants / QR-barcode labels** in web UI (§5.1); model fields exist.
- `G20` — Stocktakes lack category/brand scoping.
- `G22` — `helmet` not installed; other HTTP hardening present (`apps/api/src/main.ts`).
- `G23` — Redis/BullMQ configured but unused (no background queues).
- `G24` — No `prisma migrate` check/guard on boot.
- `G25` — No 50k-row performance benchmark (§9).
- `G27` — §7.4 **stock-valuation equation** absent from `packages/shared`/Dart (server-only).
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
3. **G22** Add `helmet`.
4. **G6** Tenant isolation: enforce non-null `companyId` on write paths + add RLS migration (+ regression tests).
5. **G5** Mobile: encrypt Drift DB + move tokens to secure storage.
6. **G4** Mobile: fail-loud device registration + remote device revoke + optional device lock.

### Batch B — Core correctness
7. **G3** Record `StatementRevision` on edit-after-approval (+ audit + test).
8. **G7** Min-sale-price floor, percent↔value conversion, below-price alert.
9. **G8** Draft-level stock reservation.
10. **G27** Stock-valuation equation parity in `shared` + Dart.
11. **G9** Return mode/settlement semantics.
12. **G10** Landed-cost shipping apportionment.

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
| 2026-10-12 | **G21** §4.2 permission-cell reconciliation (rep.track / stocktake.view) | ✅ FIXED |
| 2026-10-12 | **G22 (next)** add `helmet` | not started |
