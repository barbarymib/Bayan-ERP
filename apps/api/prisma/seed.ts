import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashSync } from 'bcryptjs';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS_MERGED } from '../src/auth/role-permissions';

// اتصال واحد (max: 1) لأن دالة RLS تقرأ GUC على مستوى الجلسة أثناء البذر (§12).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
});


const ROLES: { code: string; nameAr: string }[] = [
  { code: 'ADMIN', nameAr: 'مدير النظام' },
  { code: 'OWNER', nameAr: 'المدير العام / المالك' },
  { code: 'ACCOUNTANT', nameAr: 'محاسب' },
  { code: 'WAREHOUSEKEEPER', nameAr: 'أمين مخزن' },
  { code: 'SALES_OFFICE', nameAr: 'موظف مبيعات (مكتب)' },
  { code: 'SALES_REP', nameAr: 'مندوب مبيعات' },
  { code: 'REP_SUPERVISOR', nameAr: 'مشرف المناديب' },
];

const UNITS: { code: string; nameAr: string; measurement: 'COUNT' | 'WEIGHT' }[] = [
  { code: 'kg', nameAr: 'كجم', measurement: 'WEIGHT' },
  { code: 'ton', nameAr: 'طن', measurement: 'WEIGHT' },
  { code: 'bar', nameAr: 'سيخ', measurement: 'COUNT' },
  { code: 'pc', nameAr: 'قطعة', measurement: 'COUNT' },
  { code: 'bag', nameAr: 'شيكارة', measurement: 'COUNT' },
  { code: 'bottle', nameAr: 'عبوة', measurement: 'COUNT' },
  { code: 'can', nameAr: 'جركن', measurement: 'COUNT' },
  { code: 'carton', nameAr: 'كرتونة', measurement: 'COUNT' },
  { code: 'box', nameAr: 'علبة', measurement: 'COUNT' },
  { code: 'liter', nameAr: 'لتر', measurement: 'WEIGHT' },
  { code: 'meter', nameAr: 'متر', measurement: 'WEIGHT' },
];

const PRICE_LISTS = [
  { code: 'RETAIL', nameAr: 'قطاعي' },
  { code: 'WHOLESALE', nameAr: 'جملة' },
  { code: 'WHOLESALE2', nameAr: 'جملة الجملة' },
  { code: 'PROJECTS', nameAr: 'مشاريع ومقاولين' },
];

const CATEGORIES = [
  { code: 'STEEL', nameAr: 'حديد' },
  { code: 'PAINT', nameAr: 'بويات' },
  { code: 'TOOLS', nameAr: 'أدوات' },
  { code: 'ACC', nameAr: 'إكسسوارات' },
];

const RETURN_REASONS = [
  { code: 'DEFECT' as const, nameAr: 'عيب' },
  { code: 'WRONG_ORDER' as const, nameAr: 'خطأ طلب' },
  { code: 'DAMAGED' as const, nameAr: 'تلف' },
  { code: 'OTHER' as const, nameAr: 'أخرى' },
];

// ميزات النظام (Feature Flags) §12.3 — الحالة العامة فقط هنا
const SYSTEM_FEATURES = [
  { code: 'reports.valuation', nameAr: 'تقرير تقييم المخزون' },
  { code: 'pricing.bulk', nameAr: 'التسعير الجماعي' },
  { code: 'geotracking.fleet', nameAr: 'أسطول تتبع المندوبين' },
  { code: 'printing.retail', nameAr: 'طباعة التجزئة (A4/A5/80mm)' },
  { code: 'archiving.core', nameAr: 'الترحيل والأرشفة' },
];

async function main(): Promise<void> {
  // الشركة الافتراضية (SaaS §12) — تُنشأ أولاً لربط كل بيانات الأعمال بها (عزل الاستعلامات)
  const company = await prisma.company.upsert({
    where: { code: 'bayan' },
    update: { status: 'ACTIVE', nameAr: 'شركة بيان' },
    create: { code: 'bayan', nameAr: 'شركة بيان', status: 'ACTIVE' },
  });

  // تهيئة سياق RLS لبقية البذر (نطاق الجلسة؛ اتصال واحد max: 1) (§12).
  await prisma.$executeRaw`SELECT set_config('app.current_company_id', ${String(company.id)}, false)`;

  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { nameAr: p.nameAr },
      create: p,
    });
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { nameAr: r.nameAr },
      create: r,
    });
    const allowedCodes = ROLE_PERMISSIONS_MERGED[r.code] ?? [];
    const perms = await prisma.permission.findMany({ where: { code: { in: allowedCodes } } });
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    // سحب أي صلاحية معرفة لم تعد ممنوحة للدور في مصفوفة §4.2 (مطابقة منقّية)
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: {
          code: { in: ALL_PERMISSIONS.map((p) => p.code), notIn: allowedCodes },
        },
      },
    });
  }

  for (const u of UNITS) {
    await prisma.unit.upsert({ where: { code: u.code }, update: {}, create: u });
  }

  for (const pl of PRICE_LISTS) {
    await prisma.priceList.upsert({
      where: { companyId_code: { companyId: company.id, code: pl.code } },
      update: {},
      create: { ...pl, companyId: company.id },
    });
  }

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { ...c, companyId: company.id },
    });
  }

  for (const r of RETURN_REASONS) {
    await prisma.returnReason.upsert({ where: { code: r.code }, update: {}, create: r });
  }

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MAIN' } },
    update: {},
    create: { code: 'MAIN', nameAr: 'المخزن الرئيسي', type: 'MAIN', companyId: company.id },
  });

  const retail = await prisma.priceList.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'RETAIL' } } });
  const steel = await prisma.category.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'STEEL' } } });
  const kg = await prisma.unit.findUniqueOrThrow({ where: { code: 'kg' } });
  const ton = await prisma.unit.findUniqueOrThrow({ where: { code: 'ton' } });
  const bar = await prisma.unit.findUniqueOrThrow({ where: { code: 'bar' } });
  const pc = await prisma.unit.findUniqueOrThrow({ where: { code: 'pc' } });

  for (const c of [
    { code: 'CUST-01', nameAr: 'شركة البناء الحديث', phone: '0100000001' },
    { code: 'CUST-02', nameAr: 'مؤسسة الصفا', phone: '0100000002' },
  ]) {
    await prisma.customer.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: {},
      create: { code: c.code, nameAr: c.nameAr, phone: c.phone, priceListId: retail.id, companyId: company.id },
    });
  }

  for (const s of [
    { code: 'SUP-01', nameAr: 'مصنع الحديد الوطني' },
    { code: 'SUP-02', nameAr: 'شركة الأنابيب الشرقية' },
  ]) {
    await prisma.supplier.upsert({
      where: { companyId_code: { companyId: company.id, code: s.code } },
      update: {},
      create: { code: s.code, nameAr: s.nameAr, companyId: company.id },
    });
  }

  for (const i of [
    { code: 'IR-16-10', nameAr: 'حديد تسليح 16مم - 10م', baseUnitId: kg.id },
    { code: 'PT-20-02', nameAr: 'مواسير صرف 20مم - 2م', baseUnitId: pc.id },
  ]) {
    await prisma.item.upsert({
      where: { companyId_code: { companyId: company.id, code: i.code } },
      update: {},
      create: { code: i.code, nameAr: i.nameAr, categoryId: steel.id, baseUnitId: i.baseUnitId, companyId: company.id },
    });
  }

  const irItem = await prisma.item.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'IR-16-10' } },
  });
  for (const iu of [
    { unitId: ton.id, factorToBase: 1000 },
    { unitId: bar.id, factorToBase: 15.79 },
  ]) {
    await prisma.itemUnit.upsert({
      where: { itemId_unitId: { itemId: irItem.id, unitId: iu.unitId } },
      update: {},
      create: { itemId: irItem.id, unitId: iu.unitId, factorToBase: iu.factorToBase },
    });
  }

  // وضع تجميد المخزن أثناء الجلسة الجرد (BLOCK أو WARN)
  await prisma.systemSetting.upsert({
    where: { key: 'stocktake.freeze.mode' },
    update: { value: 'BLOCK' },
    create: { key: 'stocktake.freeze.mode', value: 'BLOCK' },
  });

  // منع تجاوز المتاح عند البيع (ALLOW رصيد سالب | BLOCK احترام الحجوزات)
  await prisma.systemSetting.upsert({
    where: { key: 'stock.sale.enforce' },
    update: { value: 'ALLOW' },
    create: { key: 'stock.sale.enforce', value: 'ALLOW' },
  });

  // فترة مفتوحة حالية (ADR-1)
  const openPeriod = await prisma.period.findFirst({ where: { status: 'OPEN' } });
  if (!openPeriod) {
    const now = new Date();
    await prisma.period.create({
      data: {
        fromDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        toDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
        status: 'OPEN',
      },
    });
  }

  // الشركة الافتراضية أُنشئت في بداية main() — كل المستخدمين الحاليين ينتمون إليها

  // المشرف العام للبيئة (§12.4)
  await prisma.globalAdmin.upsert({
    where: { username: 'root' },
    update: { passwordHash: hashSync(process.env.GLOBAL_ADMIN_PASSWORD ?? 'admin123', 10), active: true },
    create: {
      username: 'root',
      nameAr: 'المشرف العام',
      passwordHash: hashSync(process.env.GLOBAL_ADMIN_PASSWORD ?? 'admin123', 10),
    },
  });

  // الميزات العامة (§12.3)
  for (const f of SYSTEM_FEATURES) {
    await prisma.systemFeature.upsert({
      where: { code: f.code },
      update: { nameAr: f.nameAr },
      create: f,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const adminEmail = 'admin@bayan.local';
  const existingAdmin = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'مدير النظام',
        email: adminEmail,
        passwordHash: hashSync(process.env.ADMIN_PASSWORD ?? 'admin123', 10),
        roleId: adminRole.id,
        companyId: company.id,
        maxItemDiscountPct: 100,
        maxInvoiceDiscountPct: 100,
      },
    });
    console.log(`Created admin user: ${adminEmail} (password: ${process.env.ADMIN_PASSWORD ?? 'admin123'})`);
  } else if (existingAdmin.companyId === null) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { companyId: company.id } });
  }

  // مندوب مبيعات تجريبي (يستخدمه السيناريو الشامل golden)
  const repRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SALES_REP' } });
  const repPhone = '0111111111';
  const existingRep = await prisma.user.findFirst({ where: { phone: repPhone } });
  if (!existingRep) {
    await prisma.user.create({
      data: {
        name: 'مندوب المبيعات',
        phone: repPhone,
        repCode: 'M03',
        passwordHash: hashSync('rep12345', 10),
        roleId: repRole.id,
        companyId: company.id,
      },
    });
  }

  const repUser = await prisma.user.findFirst({ where: { phone: repPhone } });
  const cust01 = await prisma.customer.findUnique({
    where: { companyId_code: { companyId: company.id, code: 'CUST-01' } },
  });
  if (repUser && cust01) {
    const existingAssignment = await prisma.customerRepAssignment.findFirst({
      where: { companyId: company.id, customerId: cust01.id, repId: repUser.id },
    });
    if (!existingAssignment) {
      await prisma.customerRepAssignment.create({
        data: { companyId: company.id, customerId: cust01.id, repId: repUser.id },
      });
    }
  }

  // ربط بيانات الشركة الافتراضية بجميع سجلات الأعمال (§12.2) — يمهد لعزل الاستعلامات
  const companyScopeTables = [
    'category', 'brand', 'priceList', 'item', 'itemPrice', 'priceHistory',
    'customer', 'customerRepAssignment', 'supplier', 'customerGroup',
    'warehouse', 'stockBalance', 'stockMovement', 'stockReservation',
    'period', 'openingBalance', 'numberBlock', 'priceStatement',
    'returnStatement', 'purchaseStatement', 'receipt', 'payment', 'approval', 'ledgerEntry',
    'stocktakeSession', 'stockTransfer', 'purchaseOrder', 'supplierReturn',
    'cashAccount', 'custodyHandover', 'dailyClose', 'quotation',
    'repTarget', 'deviceRegistration', 'repShift', 'repLocation', 'repVisit', 'visitPlan',
    'branch', 'specialPrice',
  ] as const;
  for (const table of companyScopeTables) {
    await (prisma as unknown as Record<string, { updateMany: (a: unknown) => Promise<unknown> }>)[table].updateMany({
      where: { companyId: null },
      data: { companyId: company.id },
    });
  }

  // حساب خزينة افتراضي (يجعله القيد النقدي المزدوج §7.3 يعمل فوراً)
  await prisma.cashAccount.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CASH-MAIN' } },
    update: {},
    create: { code: 'CASH-MAIN', nameAr: 'الصندوق الرئيسي', type: 'CASH', companyId: company.id },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
