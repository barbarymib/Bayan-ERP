import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS_MERGED,
} from '../src/auth/role-permissions.js';

// أعمدة §4.2: Admin / Owner / Accountant / Warehousekeeper / SalesOffice / SalesRep / RepSupervisor
const MAPPED = [
  'statement.create',
  'statement.edit_approved',
  'discount.line',
  'discount.header',
  'cost.view',
  'return.create',
  'return.approve',
  'return.receive',
  'stocktake.view',
  'stocktake.execute',
  'stocktake.approve',
  'archive.run',
  'rep.track',
  'price.manage',
];

// الخلايا الثابتة من مصفوفة §4.2 (غيّر القيم الحرفية فقط عند تغيير مصفوفة الصلاحيات)
const EXPECTED: Record<string, string[]> = {
  ADMIN: [...MAPPED],
  OWNER: [
    'statement.create',
    'statement.edit_approved',
    'discount.line',
    'discount.header',
    'cost.view',
    'return.create',
    'return.approve',
    'stocktake.approve',
    'stocktake.view',
    'archive.run',
    'rep.track',
    'price.manage',
  ],
  ACCOUNTANT: [
    'statement.create',
    'statement.edit_approved',
    'discount.line',
    'discount.header',
    'cost.view',
    'return.create',
    'return.approve',
    'stocktake.view',
    'price.manage',
  ],
  WAREHOUSEKEEPER: ['return.receive', 'stocktake.view', 'stocktake.execute'],
  SALES_OFFICE: ['statement.create', 'discount.line', 'discount.header', 'return.create'],
  SALES_REP: ['statement.create', 'discount.line', 'discount.header', 'return.create'],
  REP_SUPERVISOR: [
    'statement.create',
    'statement.edit_approved',
    'discount.line',
    'discount.header',
    'return.create',
    'return.approve',
    'rep.track',
  ],
};

describe('§4.2 permission matrix', () => {
  for (const [role, expected] of Object.entries(EXPECTED)) {
    it(`دور ${role} يطابق خلية §4.2 (لا زيادة ولا نقص في الخلايا المعيّنة)`, () => {
      const actual = (ROLE_PERMISSIONS_MERGED[role] ?? [])
        .filter((c) => MAPPED.includes(c))
        .sort();
      expect(actual).toEqual([...expected].sort());
    });
  }

  it('R3-C1: صاحب المخزن يملك stocktake.execute وsync.use معاً (مدخل الجرد من الموبايل)', () => {
    const wk = ROLE_PERMISSIONS_MERGED['WAREHOUSEKEEPER'] ?? [];
    expect(wk).toContain('stocktake.execute');
    expect(wk).toContain('sync.use');
  });

  it('كل صلاحية معرفة يُمنحها دور واحد على الأقل', () => {
    for (const p of ALL_PERMISSIONS) {
      const holders = Object.values(ROLE_PERMISSIONS_MERGED).filter((codes) =>
        codes.includes(p.code),
      ).length;
      expect(holders, `permission ${p.code}`).toBeGreaterThan(0);
    }
  });

  it('G21: المندوب والمشرف يحتفظان بالإبلاغ الجغرافي الذاتي geo.report ولا يملكهما rep.track', () => {
    const rep = ROLE_PERMISSIONS_MERGED['SALES_REP'] ?? [];
    const sup = ROLE_PERMISSIONS_MERGED['REP_SUPERVISOR'] ?? [];
    expect(rep).not.toContain('rep.track');
    expect(rep).toContain('geo.report');
    expect(sup).toContain('geo.report');
    expect(sup).toContain('rep.track');
    expect(ROLE_PERMISSIONS_MERGED['ACCOUNTANT'] ?? []).not.toContain('geo.report');
  });

  it('R3-B14: statement.cancel ممنوحة لـ ADMIN/OWNER/ACCOUNTANT/REP_SUPERVISOR وغير ممنوحة للمناديب/المخزن', () => {
    for (const role of ['ADMIN', 'OWNER', 'ACCOUNTANT', 'REP_SUPERVISOR']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).toContain('statement.cancel');
    }
    for (const role of ['SALES_REP', 'SALES_OFFICE', 'WAREHOUSEKEEPER']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).not.toContain('statement.cancel');
    }
  });

  it('R3-B15: company.manage ممنوحة لـ ADMIN/OWNER وغير ممنوحة لبقية الأدوار', () => {
    for (const role of ['ADMIN', 'OWNER']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).toContain('company.manage');
    }
    for (const role of ['ACCOUNTANT', 'SALES_REP', 'SALES_OFFICE', 'WAREHOUSEKEEPER', 'REP_SUPERVISOR']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).not.toContain('company.manage');
    }
  });

  it('R4-B9: credit.exception.approve ممنوحة لـ ADMIN/OWNER/ACCOUNTANT/REP_SUPERVISOR وغير ممنوحة للمناديب/المخزن', () => {
    for (const role of ['ADMIN', 'OWNER', 'ACCOUNTANT', 'REP_SUPERVISOR']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).toContain('credit.exception.approve');
    }
    for (const role of ['SALES_REP', 'SALES_OFFICE', 'WAREHOUSEKEEPER']) {
      expect(ROLE_PERMISSIONS_MERGED[role] ?? [], role).not.toContain('credit.exception.approve');
    }
  });
});