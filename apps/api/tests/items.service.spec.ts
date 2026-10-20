import { ConflictException, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ItemsService } from '../src/items/items.service.js';
import type { PrismaService } from '../src/prisma/prisma.module.js';
import type { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import type { ObjectStorage } from '../src/common/object-storage.js';

type Row = Record<string, unknown>;

const makeAudits = (sink?: Row[]) =>
  ({
    write: async (entry: Row) => {
      sink?.push(entry);
    },
  }) as unknown as AuditLogsService;

const UNIT_IDS: Record<string, number> = { kg: 11, ton: 10, bar: 12 };

function makePrisma(opts: { failUpdate?: boolean; failItemImageCreate?: boolean; itemImage?: Row | null } = {}) {
  const state = {
    update: [] as Row[],
    create: [] as Row[],
    finds: [] as Row[],
    audit: [] as Row[],
    findUniqueArgs: [] as Row[],
    itemImageCreate: [] as Row[],
    itemImageUpdate: [] as Row[],
    itemImageDelete: [] as Row[],
  };
  const prisma = {
    item: {
      findUnique: async (a: Row) => {
        state.findUniqueArgs.push(a);
        return { id: 1, companyId: 1, nameAr: 'حديد', nameEn: null, active: true, categoryId: 2, imageUrl: null } as never;
      },
      findFirst: async () => null,
      findMany: async (a: Row) => {
        state.finds.push(a);
        return [];
      },
      count: async () => 0,
      create: async (a: { data: Row }) => {
        state.create.push(a.data);
        return { id: 1, ...a.data } as never;
      },
      update: async (a: { data: Row }) => {
        if (opts.failUpdate) throw new Error('db down');
        state.update.push(a.data);
        return { id: 1, ...a.data } as never;
      },
    },
    itemImage: {
      count: async () => 0,
      create: async (a: { data: Row }) => {
        if (opts.failItemImageCreate) throw new Error('db down');
        state.itemImageCreate.push(a.data);
        return { id: 10, ...a.data } as never;
      },
      findUnique: async () => (('itemImage' in opts ? opts.itemImage : null) ?? null) as never,
      update: async (a: { data: Row }) => {
        state.itemImageUpdate.push(a.data);
        return { id: 10, ...a.data } as never;
      },
      delete: async (a: { where: Row }) => {
        state.itemImageDelete.push(a.where);
        return { id: 10 } as never;
      },
    },
    category: { findFirst: async () => ({ id: 2, code: 'STEEL' }) as never },
    brand: { findFirst: async () => ({ id: 3, code: 'B1' }) as never },
    unit: {
      findUnique: async (a: { where: { code: string } }) => {
        const id = UNIT_IDS[a.where.code];
        return (id ? { id, code: a.where.code } : null) as never;
      },
    },
  } as unknown as PrismaService;
  return { prisma, state };
}

describe('ItemsService — تعديل بيانات الصنف الكاملة (R3-A10)', () => {
  it('يستبدل وحدات التحويل والخصائص عند التعديل (deleteMany + create)', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(
      1,
      {
        itemUnits: [{ unitCode: 'ton', factorToBase: 1000 }, { unitCode: 'bar', factorToBase: 10.656, isSale: true, isPurchase: false, allowDecimal: true, barcode: 'BC-1' }],
        attributes: [{ key: 'الدرجة', value: '36' }],
      },
      1,
    );
    expect(state.update[0]!.itemUnits).toEqual({
      deleteMany: {},
      create: [
        { unitId: 10, factorToBase: 1000, isSale: true, isPurchase: true, allowDecimal: true, barcode: undefined },
        { unitId: 12, factorToBase: 10.656, isSale: true, isPurchase: false, allowDecimal: true, barcode: 'BC-1' },
      ],
    });
    expect(state.update[0]!.attributes).toEqual({ deleteMany: {}, create: [{ key: 'الدرجة', value: '36' }] });
  });

  it('يمرّر brandCode/origin/minSalePrice/imageUrl/parentItemId للخادم', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(1, { brandCode: 'B1', origin: 'مصر', minSalePrice: 42000, imageUrl: 'http://x/img.png', parentItemId: 5 }, 1);
    expect(state.update[0]!).toMatchObject({ brandId: 3, origin: 'مصر', minSalePrice: 42000, imageUrl: 'http://x/img.png', parentItemId: 5 });
  });

  it('يمنع صنفاً أن يكون التنويع الأساسي لنفسه', async () => {
    const { prisma } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await expect(svc.update(1, { parentItemId: 1 }, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('يرفض وحدة تحويل غير معروفة', async () => {
    const { prisma } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await expect(svc.update(1, { itemUnits: [{ unitCode: 'bogus', factorToBase: 1 }] }, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('لا يعمد وحدات/خصائص إذا لم تُمرَّر (تعديل جزئي)', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.update(1, { nameAr: 'اسم جديد' }, 1);
    expect(state.update[0]!.itemUnits).toBeUndefined();
    expect(state.update[0]!.attributes).toBeUndefined();
  });

  it('تتضمّن قائمة الأصناف وحدات التحويل', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.list({}, 1);
    expect((state.finds[0]!.include as Row).itemUnits).toBeTruthy();
  });

  it('ينشئ الصنف مع وحدات التحويل والخصائص', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.create(
      {
        code: 'T-1',
        nameAr: 'صنف',
        categoryCode: 'STEEL',
        baseUnitCode: 'kg',
        itemUnits: [{ unitCode: 'ton', factorToBase: 1000 }],
        attributes: [{ key: 'النوع', value: 'ملحوم' }],
      },
      1,
    );
    expect(state.create[0]!.itemUnits).toEqual({
      create: [{ unitId: 10, factorToBase: 1000, isSale: true, isPurchase: true, allowDecimal: true, barcode: undefined }],
    });
    expect(state.create[0]!.attributes).toEqual({ create: [{ key: 'النوع', value: 'ملحوم' }] });
  });
});

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeStorage() {
  const saved: { path: string; data: Buffer }[] = [];
  const removed: string[] = [];
  const loaded = Buffer.from('stored-bytes');
  const storage = {
    save: async (path: string, data: Buffer) => {
      saved.push({ path, data });
      return path;
    },
    load: async () => loaded,
    remove: async (id: string) => {
      removed.push(id);
    },
  } as unknown as ObjectStorage;
  return { storage, saved, removed, loaded };
}

describe('ItemsService — صور الأصناف (G19 · §5.1)', () => {
  it('يحفظ data URL في التخزين ويحدّث imageUrl مع مسار حسب الشركة/الصنف', async () => {
    const { prisma, state } = makePrisma();
    const { storage, saved } = makeStorage();
    const audits: Row[] = [];
    const svc = new ItemsService(prisma, makeAudits(audits), storage);
    const updated = await svc.uploadImage(1, PNG_1PX, 1, 7);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.path).toMatch(/^items\/1\/1\/\d+\.png$/);
    expect(saved[0]!.data.length).toBeGreaterThan(10);
    expect(state.update[0]!.imageUrl).toBe(saved[0]!.path);
    expect(updated.imageUrl).toBe(saved[0]!.path);
    expect(audits[0]!.action).toBe('item.image');
  });

  it('يرفض data URL غير صالح وبأكثر من 5MB', async () => {
    const { prisma } = makePrisma();
    const { storage } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);
    await expect(svc.uploadImage(1, 'data:text/plain;base64,aGk=', 1)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    const huge = `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`;
    await expect(svc.uploadImage(1, huge, 1)).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('يحذف الملف المحفوظ إذا فشل تحديث قاعدة البيانات', async () => {
    const { prisma } = makePrisma({ failUpdate: true });
    const { storage, removed } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);
    await expect(svc.uploadImage(1, PNG_1PX, 1)).rejects.toThrow('db down');
    expect(removed).toHaveLength(1);
  });

  it('clearImage يفرّغ imageUrl ويحذف الملف من التخزين', async () => {
    const { prisma, state } = makePrisma();
    const { storage, removed } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);
    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: 'items/1/1/9.png' })) as never;
    await svc.clearImage(1, 1, 7);
    expect(state.update[0]!.imageUrl).toBeNull();
    expect(removed).toHaveLength(1);
  });

  it('getImageSource يمرّر data URL ويحوّل روابط http ويحمّل مسارات التخزين مع نوع المحتوى', async () => {
    const { prisma } = makePrisma();
    const { storage, loaded } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);

    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: PNG_1PX })) as never;
    const dataSrc = await svc.getImageSource(1, 1);
    expect(dataSrc.kind).toBe('buffer');
    if (dataSrc.kind === 'buffer') {
      expect(dataSrc.mime).toBe('image/png');
      expect(dataSrc.buffer.length).toBeGreaterThan(10);
    }

    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: 'https://cdn.example.com/a.png' })) as never;
    const redirectSrc = await svc.getImageSource(1, 1);
    expect(redirectSrc).toEqual({ kind: 'redirect', url: 'https://cdn.example.com/a.png' });

    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: 'items/1/1/9.png' })) as never;
    const storedSrc = await svc.getImageSource(1, 1);
    expect(storedSrc.kind).toBe('buffer');
    if (storedSrc.kind === 'buffer') {
      expect(storedSrc.mime).toBe('image/png');
      expect(storedSrc.buffer).toBe(loaded);
    }

    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: null })) as never;
    await expect(svc.getImageSource(1, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('القائمة تتضمن الصنف الأب وعدّاد التنويعات', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.list({}, 1);
    const include = state.finds[0]!.include as Row;
    expect(include.parent).toBeTruthy();
    expect(include._count).toBeTruthy();
  });
});

describe('ItemsService — معرض صور الصنف (R4-C2 · §5.1 «صور للصنف»)', () => {
  it('رفع صورة معرض يحفظها في التخزين وينشئ صفًا مرتّبًال تنازلياً مع تدقيق', async () => {
    const { prisma, state } = makePrisma();
    const { storage, saved } = makeStorage();
    const audits: Row[] = [];
    const svc = new ItemsService(prisma, makeAudits(audits), storage);
    const item = await svc.uploadGalleryImage(1, PNG_1PX, 1, 7);
    expect(item).toBeTruthy();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.path).toMatch(/^items\/1\/1\/\d+\.png$/);
    expect(state.itemImageCreate).toHaveLength(1);
    expect(state.itemImageCreate[0]).toMatchObject({ itemId: 1, url: saved[0]!.path, sortOrder: 0 });
    expect(audits[0]!.action).toBe('item.gallery.add');
  });

  it('يرفض data URL غير صالح ويحذف الملف المحفوظ إذا فشل إنشاء الصف', async () => {
    const { prisma } = makePrisma();
    const { storage, saved } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);
    await expect(svc.uploadGalleryImage(1, 'data:text/plain;base64,aGk=', 1)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(saved).toHaveLength(0);

    const { prisma: p2 } = makePrisma({ failItemImageCreate: true });
    const { storage: s2, removed } = makeStorage();
    const svc2 = new ItemsService(p2, makeAudits(), s2);
    await expect(svc2.uploadGalleryImage(1, PNG_1PX, 1)).rejects.toThrow('db down');
    expect(removed).toHaveLength(1);
  });

  it('يرفض الرفع بلا تخزين مُهيّأ (مثل الصورة الرئيسية)', async () => {
    const { prisma } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await expect(svc.uploadGalleryImage(1, PNG_1PX, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('removeGalleryImage يحذف الصف وملف التخزين ويدوّن تدقيقاً', async () => {
    const { prisma, state } = makePrisma({ itemImage: { id: 9, itemId: 1, url: 'items/1/1/9.png' } });
    const { storage, removed } = makeStorage();
    const audits: Row[] = [];
    const svc = new ItemsService(prisma, makeAudits(audits), storage);
    await svc.removeGalleryImage(1, 9, 1, 7);
    expect(state.itemImageDelete[0]).toMatchObject({ id: 9 });
    expect(removed).toEqual(['items/1/1/9.png']);
    expect(audits[0]!.action).toBe('item.gallery.remove');
  });

  it('removeGalleryImage يرفض صفاً لصنف آخر أو مفقوداً (404) دون حذف', async () => {
    const { prisma, state } = makePrisma({ itemImage: { id: 9, itemId: 2, url: 'items/1/1/9.png' } });
    const { storage, removed } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);
    await expect(svc.removeGalleryImage(1, 9, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(state.itemImageDelete).toHaveLength(0);
    expect(removed).toHaveLength(0);

    const { prisma: p2, state: s2 } = makePrisma({ itemImage: null });
    const svc2 = new ItemsService(p2, makeAudits(), makeStorage().storage);
    await expect(svc2.removeGalleryImage(1, 99, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(s2.itemImageDelete).toHaveLength(0);
  });

  it('setCoverFromGallery يبدّل imageUrl مع صف المعرض', async () => {
    const { prisma, state } = makePrisma({ itemImage: { id: 9, itemId: 1, url: 'items/1/1/g1.png' } });
    prisma.item.findUnique = (async () => ({ id: 1, companyId: 1, imageUrl: 'items/1/1/cover.png' })) as never;
    const audits: Row[] = [];
    const svc = new ItemsService(prisma, makeAudits(audits), makeStorage().storage);
    await svc.setCoverFromGallery(1, 9, 1, 7);
    expect(state.update[0]).toMatchObject({ imageUrl: 'items/1/1/g1.png' });
    expect(state.itemImageUpdate[0]).toMatchObject({ url: 'items/1/1/cover.png' });
    expect(audits[0]!.action).toBe('item.gallery.cover');
  });

  it('setCoverFromGallery يرفض صفاً لا يخصّ الصنف (404)', async () => {
    const { prisma, state } = makePrisma({ itemImage: { id: 9, itemId: 2, url: 'g.png' } });
    const svc = new ItemsService(prisma, makeAudits(), makeStorage().storage);
    await expect(svc.setCoverFromGallery(1, 9, 1)).rejects.toBeInstanceOf(NotFoundException);
    expect(state.update).toHaveLength(0);
  });

  it('القائمة والتفاصيل تتضمن المعرض مرتّباً حسب sortOrder', async () => {
    const { prisma, state } = makePrisma();
    const svc = new ItemsService(prisma, makeAudits());
    await svc.list({}, 1);
    expect((state.finds[0]!.include as Row).images).toBeTruthy();
    await svc.findOne(1, 1);
    const args = state.findUniqueArgs.at(-1)!;
    expect((args.include as Row).images).toBeTruthy();
  });

  it('getGalleryImageSource يمرّر data URL ويحوّل http ويحمّل من التخزين', async () => {
    const { prisma } = makePrisma({ itemImage: { id: 9, itemId: 1, url: PNG_1PX } });
    const { storage, loaded } = makeStorage();
    const svc = new ItemsService(prisma, makeAudits(), storage);

    const dataSrc = await svc.getGalleryImageSource(1, 9, 1);
    expect(dataSrc.kind).toBe('buffer');
    if (dataSrc.kind === 'buffer') expect(dataSrc.mime).toBe('image/png');

    prisma.itemImage.findUnique = (async () => ({
      id: 9,
      itemId: 1,
      url: 'https://cdn.example.com/a.png',
    })) as never;
    expect(await svc.getGalleryImageSource(1, 9, 1)).toEqual({ kind: 'redirect', url: 'https://cdn.example.com/a.png' });

    prisma.itemImage.findUnique = (async () => ({ id: 9, itemId: 1, url: 'items/1/1/9.png' })) as never;
    const storedSrc = await svc.getGalleryImageSource(1, 9, 1);
    expect(storedSrc.kind).toBe('buffer');
    if (storedSrc.kind === 'buffer') expect(storedSrc.buffer).toBe(loaded);

    prisma.itemImage.findUnique = (async () => null) as never;
    await expect(svc.getGalleryImageSource(1, 9, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
