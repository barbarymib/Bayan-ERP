import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { SalesOpsService } from '../common/sales-ops.service.js';
import { StockService } from '../common/stock.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { tenantWhere } from '../common/tenant.js';
import type { DecideApprovalDto, QueryApprovalsDto } from './approvals.dto.js';

const TYPE_PERMISSION: Record<string, string> = {
  ITEM_DISCOUNT: 'discount.approve',
  HEADER_DISCOUNT: 'discount.approve',
  BELOW_COST: 'discount.approve',
  BELOW_MIN_PRICE: 'discount.approve',
  RETURN: 'return.approve',
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: SalesOpsService,
    private readonly stock: StockService,
    private readonly audits: AuditLogsService,
  ) {}

  async list(query: QueryApprovalsDto, companyId: number | null = null) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.approval.findMany({
      where: { ...tenantWhere(companyId), ...(query.status ? { status: query.status } : { status: 'PENDING' }) },
      include: {
        requestedBy: { select: { id: true, name: true, repCode: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 100),
    });

    // إثراء ببيانات المستند المرتبط
    const enriched: Record<number, { number: string; label: string }> = {};
    const stIds = rows.filter((r) => r.refType === 'price_statement').map((r) => r.refId);
    const rtIds = rows.filter((r) => r.refType === 'return_statement').map((r) => r.refId);
    if (stIds.length) {
      const sts = await this.prisma.priceStatement.findMany({
        where: { id: { in: stIds }, ...tenantWhere(companyId) },
        select: { id: true, number: true },
      });
      for (const s of sts) enriched[s.id] = { number: s.number, label: 'بيان أسعار' };
    }
    if (rtIds.length) {
      const rts = await this.prisma.returnStatement.findMany({
        where: { id: { in: rtIds }, ...tenantWhere(companyId) },
        select: { id: true, number: true },
      });
      for (const r of rts) enriched[r.id] = { number: r.number, label: 'بيان مرتجع' };
    }

    return {
      items: rows.map((r) => ({
        ...r,
        refJson: r.refJson ?? undefined,
        document: enriched[r.refId] ?? null,
      })),
    };
  }

  async decide(id: number, dto: DecideApprovalDto, user: AuthUser) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval || (approval.companyId != null && approval.companyId !== (user.companyId ?? null))) {
      throw new NotFoundException(`Approval ${id} not found`);
    }
    const required = TYPE_PERMISSION[approval.type] ?? '';
    if (!user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Approval already ${approval.status.toLowerCase()}`);
    }
    // التحقق من قابلية الاعتماد (المستند غير ملغي + صلاحية رد النقدية عند الحاجة) قبل تغيير الحالة
    if (dto.approved) {
      await this.assertDecidable(approval, user);
    }

    const next = dto.approved ? 'APPROVED' : 'REJECTED';
    await this.prisma.approval.update({
      where: { id },
      data: {
        status: next,
        decidedById: user.id,
        decidedAt: new Date(),
        note: dto.note,
      },
    });
    await this.audits.write({
      userId: user.id,
      action: 'approval.decide',
      entity: 'Approval',
      entityId: id,
      beforeJson: { status: approval.status },
      afterJson: { status: next, note: dto.note ?? null },
    });

    if (dto.approved) {
      if (approval.refType === 'price_statement') {
        await this.ops.finalizeStatement(approval.refId, user);
      } else if (approval.refType === 'return_statement') {
        await this.ops.finalizeReturn(approval.refId, user);
      }
    } else {
      await this.rejectDocument(approval, dto, user);
    }
    return { id, approved: dto.approved };
  }

  /** التحقق من أن المستند المرتبط غير مُلغي قبل الاعتماد + صلاحية رد النقدية عند الحاجة. */
  private async assertDecidable(
    approval: { refType: string; refId: number; companyId?: number | null },
    user: AuthUser,
  ): Promise<void> {
    const companyId = approval.companyId ?? null;
    if (approval.refType === 'price_statement') {
      const st = await this.prisma.priceStatement.findUnique({
        where: { id: approval.refId },
        select: { status: true, companyId: true, customerId: true, net: true, warehouseId: true, lines: { select: { itemId: true, qtyBase: true } } },
      });
      if (!st || (st.companyId != null && st.companyId !== companyId)) {
        throw new NotFoundException(`Statement ${approval.refId} not found`);
      }
      if (st.status === 'CANCELLED') throw new BadRequestException('كشف الحساب ملغي — لا يمكن اعتماده');
      // إعادة فحص الحد الائتماني عند الاعتماد (§5.4) — قد تتغيّر الأرصدة بين الإنشاء والاعتماد
      await this.ops.assertCustomerCredit(st.customerId, Number(st.net), companyId);
      // R3-B11: إعادة فحص الرصيد المتاح عند الاعتماد (§5.6) — قد يتغيّر المخزون بين الإنشاء والاعتماد
      // (يُستثنى حجز البيان نفسه). يُنفَّذ قبل تغيير حالة الموافقة حتى لا يُعلّق قرار بلا ترحيل.
      await this.stock.assertSalePermitted(
        st.warehouseId,
        st.lines.map((l) => ({ itemId: l.itemId, qtyBase: Number(l.qtyBase) })),
        companyId,
        { refType: 'price_statement', refId: approval.refId },
      );
    } else if (approval.refType === 'return_statement') {
      const rt = await this.prisma.returnStatement.findUnique({ where: { id: approval.refId }, select: { status: true, companyId: true, settlement: true } });
      if (!rt || (rt.companyId != null && rt.companyId !== companyId)) {
        throw new NotFoundException(`Return ${approval.refId} not found`);
      }
      if (rt.status === 'CANCELLED') throw new BadRequestException('بيان المرتجع ملغي — لا يمكن اعتماده');
      if (rt.settlement === 'CASH' && !user.permissions.includes('return.cash_refund')) {
        throw new ForbiddenException('Missing permission: return.cash_refund');
      }
    }
  }

  /** رفض الموافقة: إلغاء المستند المرتبط + تحرير الحجوزات + إغلاق باقي الموافقات المعلقة له. */
  private async rejectDocument(
    approval: { id: number; refType: string; refId: number },
    dto: DecideApprovalDto,
    user: AuthUser,
  ): Promise<void> {
    const now = new Date();
    const reasoned = dto.note?.trim() ? dto.note.trim() : null;
    await this.prisma.$transaction(async (tx) => {
      await this.stock.releaseReservations(tx, approval.refType, approval.refId);
      if (approval.refType === 'price_statement') {
        const st = await tx.priceStatement.findUnique({ where: { id: approval.refId }, select: { status: true, companyId: true } });
        if (!st || (st.companyId != null && st.companyId !== (user.companyId ?? null))) {
          throw new NotFoundException(`Statement ${approval.refId} not found`);
        }
        if (st.status === 'DRAFT') {
          await tx.priceStatement.update({
            where: { id: approval.refId },
            data: { status: 'CANCELLED', cancelledById: user.id, cancelledAt: now, cancelReason: reasoned },
          });
        }
      } else if (approval.refType === 'return_statement') {
        const rt = await tx.returnStatement.findUnique({ where: { id: approval.refId }, select: { status: true, companyId: true } });
        if (!rt || (rt.companyId != null && rt.companyId !== (user.companyId ?? null))) {
          throw new NotFoundException(`Return ${approval.refId} not found`);
        }
        if (rt.status === 'DRAFT') {
          await tx.returnStatement.update({ where: { id: approval.refId }, data: { status: 'CANCELLED' } });
        }
      }
      await tx.approval.updateMany({
        where: {
          refType: approval.refType,
          refId: approval.refId,
          status: 'PENDING',
          id: { not: approval.id },
          ...tenantWhere(user.companyId ?? null),
        },
        data: {
          status: 'REJECTED',
          decidedById: user.id,
          decidedAt: now,
          note: reasoned ?? 'أُغلق بسبب رفض موافقة أخرى على نفس المستند',
        },
      });
    });
    await this.audits.write({
      userId: user.id,
      action: 'approval.reject_cancel',
      entity: approval.refType === 'price_statement' ? 'PriceStatement' : 'ReturnStatement',
      entityId: approval.refId,
      afterJson: { status: 'CANCELLED', note: reasoned },
    });
  }
}