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

  it('كل صلاحية معرفة يُمنحها دور واحد على الأقل', () => {
    for (const p of ALL_PERMISSIONS) {
      const holders = Object.values(ROLE_PERMISSIONS_MERGED).filter((codes) =>
        codes.includes(p.code),
      ).length;
      expect(holders, `permission ${p.code}`).toBeGreaterThan(0);
    }
  });
});