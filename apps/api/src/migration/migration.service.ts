import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { StockService } from '../common/stock.service.js';
import { tenantWhere } from '../common/tenant.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import type { LegacyImportDto } from './migration.dto.js';

export interface MigrationRowResult {
  ref: string;
  action: 'CREATED' | 'UPDATED' | 'SKIPPED';
  error?: string;
}

export type MigrationSections = keyof LegacyImportDto;

export interface MigrationImportResult {
  mode: string;
  strict: boolean;
  counts: Partial<Record<MigrationSections, number>>;
  errors: number;
  total: number;
  results: Partial<Record<MigrationSections, MigrationRowResult[]>>;
}

const DEFAULTS = {
  unitCode: 'PCS',
  priceListCode: 'RETAIL',
  categoryCode: 'GEN',
};

/**
 * ترحيل بيانات قديمة (§المرحلة 7): استيراد سجلّي دفعة واحدة —
 * فئات/وحدات/قوائم أسعار/مخازن/أصناف وأسعارها/موردون/عملاء بأرصدة افتتاحية + رصيد مخزني.
 * STRICT يلغي الاستيراد كاملاً عند أي تعارض على الكود.
 */
@Injectable()
export class MigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly audits: AuditLogsService,
  ) {}

  async importPayload(
    dto: LegacyImportDto,
    userId: number,
    companyId: number | null = null,
  ): Promise<MigrationImportResult> {
    const mode = dto.mode ?? 'MERGE';
    const strict = mode === 'STRICT';
    const results: Partial<Record<MigrationSections, MigrationRowResult[]>> = {
      categories: [],
      units: [],
      priceLists: [],
      warehouses: [],
      items: [],
      suppliers: [],
      customers: [],
      openingStock: [],
    };
    let errors = 0;

    await this.prisma.$transaction(async (tx) => {
      const [cats, units, pls, whs, items, sups, custs, users] = await Promise.all([
        tx.category.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.unit.findMany(),
        tx.priceList.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.warehouse.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.item.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.supplier.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.customer.findMany({ where: { ...tenantWhere(companyId) } }),
        tx.user.findMany({ where: { ...tenantWhere(companyId) }, select: { id: true, repCode: true } }),
      ]);

      const catMap = new Map(cats.map((c) => [c.code, c] as const));
      const unitMap = new Map(units.map((u) => [u.code, u] as const));
      const plMap = new Map(pls.map((p) => [p.code, p] as const));
      const whMap = new Map(whs.map((w) => [w.code, w] as const));
      const itemMap = new Map(items.map((i) => [i.code, i] as const));
      const supMap = new Map(sups.map((s) => [s.code, s] as const));
      const custMap = new Map(custs.map((c) => [c.code, c] as const));
      const repMap = new Map(
        users.filter((u) => u.repCode).map((u) => [u.repCode as string, u] as const),
      );

      const record = async (
        key: MigrationSections,
        ref: string,
        fn: () => Promise<MigrationRowResult>,
      ): Promise<void> => {
        try {
          const row = await fn();
          results[key]?.push(row);
        } catch (err) {
          errors++;
          const message = err instanceof Error ? err.message : String(err);
          results[key]?.push({ ref, action: 'SKIPPED', error: message });
          if (strict) throw new BadRequestException(`${ref}: ${message}`);
        }
      };

      const ensureCategory = async (code: string, nameAr?: string, parentCode?: string) => {
        let c = catMap.get(code);
        if (!c) {
          c = await tx.category.create({
            data: {
              companyId,
              code,
              nameAr: nameAr ?? code,
              parentId: parentCode ? (catMap.get(parentCode)?.id ?? null) : null,
            },
          });
          catMap.set(code, c);
        }
        return c;
      };

      const ensureUnit = async (
        code: string,
        nameAr?: string,
        measurement: 'COUNT' | 'WEIGHT' = 'COUNT',
      ) => {
        let u = unitMap.get(code);
        if (!u) {
          u = await tx.unit.create({
            data: { code, nameAr: nameAr ?? code, measurement },
          });
          unitMap.set(code, u);
        }
        return u;
      };

      const ensurePriceList = async (code: string, nameAr?: string) => {
        let p = plMap.get(code);
        if (!p) {
          p = await tx.priceList.create({ data: { companyId, code, nameAr: nameAr ?? code } });
          plMap.set(code, p);
        }
        return p;
      };

      // يحافظ على تزامن CustomerRepAssignment (تغذية مندوب الجوال) مع Customer.repId.
      const ensureAssignment = async (customerId: number, repId: number) => {
        const active = await tx.customerRepAssignment.findFirst({
          where: { customerId, repId, toDate: null },
        });
        if (active) return;
        await tx.customerRepAssignment.updateMany({
          where: { customerId, toDate: null, repId: { not: repId } },
          data: { toDate: new Date() },
        });
        await tx.customerRepAssignment.create({ data: { companyId, customerId, repId } });
      };

      // --- فئات ---
      for (const c of dto.categories ?? []) {
        await record('categories', c.code, async () => {
          const existing = catMap.get(c.code);
          if (existing) {
            if (strict) throw new Error('duplicate category code');
            return { ref: c.code, action: 'UPDATED' as const };
          }
          await ensureCategory(c.code, c.nameAr, c.parentCode);
          return { ref: c.code, action: 'CREATED' as const };
        });
      }

      // --- وحدات ---
      for (const u of dto.units ?? []) {
        await record('units', u.code, async () => {
          const existing = unitMap.get(u.code);
          if (existing) {
            if (strict) throw new Error('duplicate unit code');
            return { ref: u.code, action: 'UPDATED' as const };
          }
          await ensureUnit(u.code, u.nameAr, u.measurement ?? 'COUNT');
          return { ref: u.code, action: 'CREATED' as const };
        });
      }

      // --- قوائم أسعار ---
      for (const p of dto.priceLists ?? []) {
        await record('priceLists', p.code, async () => {
          const existing = plMap.get(p.code);
          if (existing) {
            if (strict) throw new Error('duplicate price list code');
            return { ref: p.code, action: 'UPDATED' as const };
          }
          await ensurePriceList(p.code, p.nameAr);
          return { ref: p.code, action: 'CREATED' as const };
        });
      }

      // --- مخازن ---
      for (const w of dto.warehouses ?? []) {
        await record('warehouses', w.code, async () => {
          const existing = whMap.get(w.code);
          const keeper = w.keeperRepCode ? repMap.get(w.keeperRepCode) : undefined;
          const data = {
            nameAr: w.nameAr,
            type: w.type ?? 'MAIN',
            keeperId: keeper?.id ?? null,
          };
          if (existing) {
            if (strict) throw new Error('duplicate warehouse code');
            await tx.warehouse.update({ where: { id: existing.id }, data });
            return { ref: w.code, action: 'UPDATED' as const };
          }
          await tx.warehouse.create({ data: { companyId, code: w.code, ...data } });
          whMap.set(w.code, { id: -1, ...data } as never);
          const fresh = await tx.warehouse.findFirst({
            where: { code: w.code, ...tenantWhere(companyId) },
          });
          if (fresh) whMap.set(w.code, fresh as never);
          return { ref: w.code, action: 'CREATED' as const };
        });
      }

      // --- أصناف ---
      for (const it of dto.items ?? []) {
        await record('items', it.code, async () => {
          const unit = unitMap.get(it.baseUnitCode);
          if (!unit) throw new Error(`unit '${it.baseUnitCode}' not found`);
          const cat = await ensureCategory(it.categoryCode ?? DEFAULTS.categoryCode);

          const existing = itemMap.get(it.code);
          if (existing) {
            if (strict) throw new Error('duplicate item code');
            await tx.item.update({
              where: { id: existing.id },
              data: {
                nameAr: it.nameAr,
                nameEn: it.nameEn,
                categoryId: cat.id,
                barcode: it.barcode ?? existing.barcode,
                lastPurchaseCost: it.lastCost ?? existing.lastPurchaseCost,
                minStock: it.minStock ?? existing.minStock,
                active: it.active ?? existing.active,
              },
            });
          } else {
            const created = await tx.item.create({
              data: {
                companyId,
                code: it.code,
                nameAr: it.nameAr,
                nameEn: it.nameEn,
                categoryId: cat.id,
                baseUnitId: unit.id,
                barcode: it.barcode ?? null,
                lastPurchaseCost: it.lastCost ?? null,
                minStock: it.minStock ?? 0,
                active: it.active ?? true,
              },
            });
            itemMap.set(it.code, created as never);
          }

          const itemId = itemMap.get(it.code)?.id;
          if (itemId === undefined) throw new Error('item id missing');

          for (const priceRow of it.prices ?? []) {
            const pl = plMap.get(priceRow.priceListCode);
            if (!pl) throw new Error(`price list '${priceRow.priceListCode}' not found`);
            const priceUnit = priceRow.unitCode ? unitMap.get(priceRow.unitCode) : unit;
            if (!priceUnit) throw new Error(`price unit '${priceRow.unitCode}' not found`);
            // R3-A7: لا فريد على (item, unit, list) بعد الآن، فالترحيل
            // يحدّث آخر سطر لهذا الثلاثي أو يُنشئه (سلوك upsert المعتاد).
            const priceScope = { itemId, unitId: priceUnit.id, priceListId: pl.id };
            const priorPrice = await tx.itemPrice.findFirst({
              where: { ...priceScope, ...(companyId != null ? { companyId } : {}) },
              orderBy: { id: 'desc' },
            });
            if (priorPrice) {
              await tx.itemPrice.update({
                where: { id: priorPrice.id },
                data: { price: priceRow.price, validTo: priceRow.validTo ? new Date(priceRow.validTo) : null },
              });
            } else {
              await tx.itemPrice.create({
                data: {
                  companyId,
                  ...priceScope,
                  price: priceRow.price,
                  validFrom: priceRow.validFrom ? new Date(priceRow.validFrom) : new Date(),
                  validTo: priceRow.validTo ? new Date(priceRow.validTo) : null,
                },
              });
            }
          }

          return { ref: it.code, action: existing ? ('UPDATED' as const) : ('CREATED' as const) };
        });
      }

      // --- موردون ---
      for (const s of dto.suppliers ?? []) {
        await record('suppliers', s.code, async () => {
          const existing = supMap.get(s.code);
          const data = {
            nameAr: s.nameAr,
            phone: s.phone,
            address: s.address,
            openingBalance: s.openingBalance ?? 0,
          };
          if (existing) {
            if (strict) throw new Error('duplicate supplier code');
            await tx.supplier.update({ where: { id: existing.id }, data });
            return { ref: s.code, action: 'UPDATED' as const };
          }
          await tx.supplier.create({ data: { companyId, code: s.code, ...data } });
          supMap.set(s.code, { id: -1, ...data } as never);
          return { ref: s.code, action: 'CREATED' as const };
        });
      }

      // --- عملاء ---
      for (const c of dto.customers ?? []) {
        await record('customers', c.code, async () => {
          const pl = await ensurePriceList(
            c.priceListCode ?? DEFAULTS.priceListCode,
            c.priceListCode ?? DEFAULTS.priceListCode,
          );
          const rep = c.repCode ? repMap.get(c.repCode) : undefined;
          const data = {
            nameAr: c.nameAr,
            nameEn: c.nameEn,
            phone: c.phone,
            activity: c.activity,
            taxNumber: c.taxNumber,
            address: c.address,
            priceListId: pl.id,
            repId: rep?.id ?? null,
            creditLimit: c.creditLimit ?? 0,
            creditDays: c.creditDays ?? 0,
            classification: c.classification ?? ('C' as const),
            openingBalance: c.openingBalance ?? 0,
          };
          const existing = custMap.get(c.code);
          if (existing) {
            if (strict) throw new Error('duplicate customer code');
            await tx.customer.update({ where: { id: existing.id }, data });
            if (rep) await ensureAssignment(existing.id, rep.id);
            return { ref: c.code, action: 'UPDATED' as const };
          }
          const created = await tx.customer.create({ data: { companyId, code: c.code, ...data } });
          if (rep) await ensureAssignment(created.id, rep.id);
          custMap.set(c.code, created as never);
          return { ref: c.code, action: 'CREATED' as const };
        });
      }

      // --- رصيد مخزني افتتاحي ---
      for (const st of dto.openingStock ?? []) {
        await record('openingStock', `${st.itemCode}@${st.warehouseCode}`, async () => {
          const item = itemMap.get(st.itemCode);
          if (!item) throw new Error(`item '${st.itemCode}' not found`);
          const wh = whMap.get(st.warehouseCode);
          if (!wh) throw new Error(`warehouse '${st.warehouseCode}' not found`);
          const dup = await tx.stockMovement.findFirst({
            where: { refType: 'inventory_open', refId: 0, itemId: item.id, warehouseId: wh.id },
          });
          if (dup) {
            if (strict) throw new Error('opening stock already imported');
            return { ref: `${st.itemCode}@${st.warehouseCode}`, action: 'UPDATED' as const };
          }
          await this.stock.purchaseIn(tx, {
            warehouseId: wh.id,
            refType: 'inventory_open',
            refId: 0,
            userId,
            companyId,
            lines: [{ itemId: item.id, qtyBase: st.qtyBase, cost: st.cost ?? null }],
          });
          return { ref: `${st.itemCode}@${st.warehouseCode}`, action: 'CREATED' as const };
        });
      }
    });

    const counts: Partial<Record<MigrationSections, number>> = {};
    let total = 0;
    for (const [k, v] of Object.entries(results) as [MigrationSections, MigrationRowResult[]][]) {
      counts[k] = v.length;
      total += v.length;
    }

    await this.audits.write({
      userId,
      action: 'migration.import',
      entity: 'Migration',
      entityId: 0,
      afterJson: { mode, strict, total, errors, counts },
    });

    return { mode, strict, counts, errors, total, results };
  }
}