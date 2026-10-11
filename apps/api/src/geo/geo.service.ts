import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';
import type { EndShiftDto, LocationDto, StartShiftDto, VisitDto } from './geo.dto.js';

/** حد النطاق الجغرافي للعميل بالمتر (§5.13: مثلاً 150م) */
export const PROXIMITY_METERS = 150;

/** مدة الاحتفاظ بسجلات الموقع (90 يوم ثم تُحذف تلقائياً — §5.13 الخصوصية) */
export const LOCATION_RETENTION_DAYS = 90;

const EARTH_RADIUS_M = 6371000;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const asNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

@Injectable()
export class GeoService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // تنظيف سجلات الموقع بعد مدة الاحتفاظ (يومياً) — لا يسقط الخادم عند غياب قاعدة البيانات
    const scheduled = () => {
      void this.cleanupOldLocations().catch((e) => {
        console.warn(`[geo] cleanup skipped: ${(e as Error)?.message ?? e}`);
      });
    };
    setTimeout(scheduled, 30_000);
    setInterval(scheduled, 24 * 60 * 60 * 1000);
  }

  async cleanupOldLocations(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const res = await this.prisma.repLocation.deleteMany({ where: { capturedAt: { lt: cutoff } } });
    return { deleted: res.count };
  }

  /** الوردية النشطة الحالية للمندوب */
  async currentShift(repId: number, companyId: number | null = null) {
    return this.prisma.repShift.findFirst({
      where: { repId, endedAt: null, ...tenantWhere(companyId) },
      include: { _count: { select: { locations: true, visits: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async startShift(repId: number, dto: StartShiftDto, companyId: number | null = null) {
    const existing = await this.currentShift(repId, companyId);
    if (existing) {
      if (dto.deviceId) await this.touchDevice(repId, dto.deviceId, companyId);
      return existing;
    }
    if (dto.deviceId) await this.touchDevice(repId, dto.deviceId, companyId);
    return this.prisma.repShift.create({
      data: {
        repId,
        startLat: dto.lat ?? undefined,
        startLng: dto.lng ?? undefined,
        companyId,
      },
      include: { _count: { select: { locations: true, visits: true } } },
    });
  }

  private async touchDevice(repId: number, deviceId: string, companyId: number | null = null): Promise<void> {
    const existing = await this.prisma.deviceRegistration.findFirst({
      where: { deviceId, ...tenantWhere(companyId) },
    });
    if (existing) {
      await this.prisma.deviceRegistration.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), active: true },
      });
    } else {
      await this.prisma.deviceRegistration.create({
        data: { deviceId, userId: repId, lastSeenAt: new Date(), companyId },
      });
    }
  }

  async endShift(repId: number, dto: EndShiftDto, companyId: number | null = null) {
    const active = await this.currentShift(repId, companyId);
    const targetId = dto.shiftId ?? active?.id;
    if (!targetId) throw new BadRequestException('لا توجد وردية نشطة');
    const shift = await this.prisma.repShift.findFirst({ where: { id: targetId, repId, ...tenantWhere(companyId) } });
    if (!shift) throw new NotFoundException('الوردية غير موجودة');
    if (shift.endedAt) throw new BadRequestException('الوردية مغلقة بالفعل');
    return this.prisma.repShift.update({
      where: { id: shift.id },
      data: { endedAt: new Date(), endLat: dto.lat ?? undefined, endLng: dto.lng ?? undefined },
      include: { _count: { select: { locations: true, visits: true } } },
    });
  }

  /** إرسال موقع (يُقبل فقط أثناء وردية نشطة — §5.13 لا تتبع خارج الوردية) */
  async pushLocation(repId: number, dto: LocationDto, companyId: number | null = null) {
    const shift = await this.currentShift(repId, companyId);
    if (!shift) throw new BadRequestException('لا توجد وردية نشطة — ابدأ الوردية أولاً');
    return this.prisma.repLocation.create({
      data: {
        repId,
        shiftId: shift.id,
        lat: dto.lat,
        lng: dto.lng,
        accuracy: dto.accuracy ?? undefined,
        battery: dto.battery ?? undefined,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
        companyId,
      },
    });
  }

  /** زيارة عميل مع مطابقة قرب الموقع (150م) */
  async recordVisit(repId: number, dto: VisitDto, companyId: number | null = null) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, ...tenantWhere(companyId) } });
    if (!customer) throw new NotFoundException('العميل غير موجود');

    const shift = await this.currentShift(repId, companyId);
    const at = dto.at ? new Date(dto.at) : undefined;

    // موقع الإرسال: من الطلب أو آخر موقع معروف في الوردية
    let lat = dto.lat ?? null;
    let lng = dto.lng ?? null;
    if (lat === null && shift) {
      const last = await this.prisma.repLocation.findFirst({
        where: { shiftId: shift.id, ...tenantWhere(companyId) },
        orderBy: { capturedAt: 'desc' },
      });
      if (last) {
        lat = asNum(last.lat);
        lng = asNum(last.lng);
      }
    }

    let outOfRange = false;
    let distanceM: number | null = null;
    const custLat = asNum(customer.lat);
    const custLng = asNum(customer.lng);
    if (lat !== null && lng !== null && custLat !== null && custLng !== null) {
      distanceM = Math.round(haversineM(lat, lng, custLat, custLng));
      outOfRange = distanceM > PROXIMITY_METERS;
    }

    const visit = await this.prisma.repVisit.create({
      data: {
        repId,
        shiftId: shift?.id ?? null,
        customerId: dto.customerId,
        status: dto.status,
        reason: dto.reason ?? (outOfRange ? `الموقع خارج نطاق العميل (${distanceM}م — الحد 150م)` : undefined),
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        at,
        companyId,
      },
      include: { customer: { select: { id: true, code: true, nameAr: true, lat: true, lng: true } } },
    });

    return {
      ...visit,
      proximity: { outOfRange, distanceM, limitM: PROXIMITY_METERS },
    };
  }

  /** قائمة الورديات (المشرف) لعرض مساراتها */
  async shiftsList(query: { repId?: number; from?: string; to?: string }, companyId: number | null = null) {
    const from = query.from ? new Date(query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = query.to ? new Date(query.to) : new Date();
    return this.prisma.repShift.findMany({
      where: {
        ...(query.repId ? { repId: query.repId } : {}),
        startedAt: { gte: from, lte: to },
        ...tenantWhere(companyId),
      },
      include: {
        rep: { select: { id: true, name: true, repCode: true } },
        _count: { select: { locations: true, visits: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  /** خريطة مباشرة: آخر موقع لكل مندوب (المشرف) */
  async liveMap(companyId: number | null = null) {
    const reps = await this.prisma.user.findMany({
      where: { role: { code: { in: ['SALES_REP', 'REP_SUPERVISOR'] } }, active: true },
      select: { id: true, name: true, repCode: true, phone: true },
    });
    return Promise.all(
      reps.map(async (rep) => {
        const shift = await this.prisma.repShift.findFirst({
          where: { repId: rep.id, endedAt: null, ...tenantWhere(companyId) },
          orderBy: { startedAt: 'desc' },
        });
        const lastLocation = shift
          ? await this.prisma.repLocation.findFirst({
              where: { shiftId: shift.id, ...tenantWhere(companyId) },
              orderBy: { capturedAt: 'desc' },
            })
          : null;
        const lastVisit = shift
          ? await this.prisma.repVisit.findFirst({
              where: { shiftId: shift.id, ...tenantWhere(companyId) },
              orderBy: { at: 'desc' },
              include: { customer: { select: { id: true, nameAr: true } } },
            })
          : null;
        const [visitCount, distance] = shift
          ? await Promise.all([this.prisma.repVisit.count({ where: { shiftId: shift.id, ...tenantWhere(companyId) } }), this.shiftStats(shift.id, companyId)])
          : [0, { distanceM: 0, dwellMinutes: 0 }];
        return {
          rep,
          shift: shift
            ? {
                id: shift.id,
                startedAt: shift.startedAt,
                durationMinutes: Math.round((Date.now() - shift.startedAt.getTime()) / 60000),
              }
            : null,
          lastLocation: lastLocation
            ? { lat: Number(lastLocation.lat), lng: Number(lastLocation.lng), accuracy: asNum(lastLocation.accuracy), at: lastLocation.capturedAt }
            : null,
          lastVisit: lastVisit ? { customer: lastVisit.customer.nameAr, at: lastVisit.at, status: lastVisit.status } : null,
          todayVisitCount: visitCount,
          todayDistanceM: distance.distanceM,
        };
      }),
    );
  }

  /** المسافة المقطوعة وزمن التوقف عند العملاء لوردية */
  private async shiftStats(shiftId: number, companyId: number | null = null): Promise<{ distanceM: number; dwellMinutes: number }> {
    const points = await this.prisma.repLocation.findMany({
      where: { shiftId, ...tenantWhere(companyId) },
      orderBy: { capturedAt: 'asc' },
      select: { lat: true, lng: true, capturedAt: true },
    });
    let distanceM = 0;
    let dwellMinutes = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (!prev || !curr) continue;
      const d = haversineM(Number(prev.lat), Number(prev.lng), Number(curr.lat), Number(curr.lng));
      distanceM += d;
      const dt = curr.capturedAt.getTime() - prev.capturedAt.getTime();
      if (d < PROXIMITY_METERS) dwellMinutes += Math.round(dt / 60000);
    }
    return { distanceM: Math.round(distanceM), dwellMinutes };
  }

  /** مسار اليوم (Route Replay) مع التوقفات والزيارات */
  async route(shiftId: number, viewerRepId?: number, companyId: number | null = null) {
    const where: { id: number; repId?: number } = viewerRepId ? { id: shiftId, repId: viewerRepId } : { id: shiftId };
    const shift = await this.prisma.repShift.findFirst({
      where: { ...where, ...tenantWhere(companyId) },
      include: { rep: { select: { id: true, name: true, repCode: true } } },
    });
    if (!shift) throw new NotFoundException('الوردية غير موجودة');

    const [locations, visits] = await Promise.all([
      this.prisma.repLocation.findMany({
        where: { shiftId, ...tenantWhere(companyId) },
        orderBy: { capturedAt: 'asc' },
        select: { id: true, lat: true, lng: true, accuracy: true, battery: true, capturedAt: true },
      }),
      this.prisma.repVisit.findMany({
        where: { shiftId, ...tenantWhere(companyId) },
        orderBy: { at: 'asc' },
        include: { customer: { select: { id: true, code: true, nameAr: true, lat: true, lng: true } } },
      }),
    ]);

    const points = locations.map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      accuracy: asNum(p.accuracy),
      battery: p.battery,
      at: p.capturedAt,
    }));

    const stats = await this.shiftStats(shiftId, companyId);

    return {
      shift: { id: shift.id, startedAt: shift.startedAt, endedAt: shift.endedAt, rep: shift.rep },
      totalDistanceM: stats.distanceM,
      estimatedDwellMinutes: stats.dwellMinutes,
      points,
      visits: visits.map((v) => ({
        id: v.id,
        customer: v.customer.nameAr,
        status: v.status,
        reason: v.reason,
        lat: asNum(v.lat),
        lng: asNum(v.lng),
        at: v.at,
        outOfRange: this.isOutOfRange(asNum(v.lat), asNum(v.lng), asNum(v.customer.lat), asNum(v.customer.lng)),
      })),
    };
  }

  private isOutOfRange(lat: number | null, lng: number | null, cLat: number | null, cLng: number | null): boolean {
    if (lat === null || lng === null || cLat === null || cLng === null) return false;
    return haversineM(lat, lng, cLat, cLng) > PROXIMITY_METERS;
  }

  /** تقارير: المسافة والزيارات والعملاء الذين لم تتم زيارتهم */
  async reportSummary(query: { from?: string; to?: string }, companyId: number | null = null) {
    const from = query.from ? new Date(query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new BadRequestException('تواريخ غير صالحة');

    const reps = await this.prisma.user.findMany({
      where: { role: { code: { in: ['SALES_REP', 'REP_SUPERVISOR'] } }, active: true },
      select: { id: true, name: true, repCode: true },
    });

    return Promise.all(
      reps.map(async (rep) => {
        const shifts = await this.prisma.repShift.findMany({
          where: { repId: rep.id, startedAt: { gte: from, lte: to }, ...tenantWhere(companyId) },
          orderBy: { startedAt: 'asc' },
        });

        let totalDistanceM = 0;
        let totalDwellMinutes = 0;
        for (const s of shifts) {
          const st = await this.shiftStats(s.id, companyId);
          totalDistanceM += st.distanceM;
          totalDwellMinutes += st.dwellMinutes;
        }

        const [visits, assignedRows] = await Promise.all([
          this.prisma.repVisit.findMany({
            where: { repId: rep.id, at: { gte: from, lte: to }, ...tenantWhere(companyId) },
            include: { customer: { select: { id: true, nameAr: true } } },
            orderBy: { at: 'asc' },
          }),
          this.prisma.customerRepAssignment.findMany({
            where: { repId: rep.id, fromDate: { lte: to }, toDate: null, ...tenantWhere(companyId) },
            include: { customer: { select: { id: true, nameAr: true, active: true } } },
          }),
        ]);

        const visitedIds = new Set(visits.map((v) => v.customer.id));
        const notVisited = assignedRows
          .filter((a) => a.customer.active !== false && !visitedIds.has(a.customer.id))
          .map((a) => ({ id: a.customer.id, nameAr: a.customer.nameAr }));

        return {
          rep,
          shiftsCount: shifts.length,
          closedShifts: shifts.filter((s) => s.endedAt).length,
          hasActiveShift: shifts.some((s) => !s.endedAt),
          totalDistanceM,
          totalDwellAtCustomersMinutes: totalDwellMinutes,
          visitsCount: visits.length,
          missedVisits: visits.filter((v) => v.status === 'MISSED').length,
          customersAssigned: assignedRows.length,
          customersVisited: visitedIds.size,
          notVisitedCustomers: notVisited,
        };
      }),
    );
  }
}