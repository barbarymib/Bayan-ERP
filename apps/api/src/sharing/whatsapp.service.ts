import { Injectable, NotFoundException } from '@nestjs/common';
import { roundMoney } from '@bayan/shared';
import { PrismaService } from '../prisma/prisma.module.js';
import { LedgerService } from '../common/ledger.service.js';
import { tenantWhere } from '../common/tenant.js';

export interface WhatsAppLink {
  url: string | null;
  phone: string | null;
  text: string;
  balance: number;
}

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** رابط إرسال كشف الحساب للعميل عبر واتساب (§5.16). */
  async statementLink(customerId: number, from?: string, to?: string, companyId: number | null = null): Promise<WhatsAppLink> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, ...tenantWhere(companyId) } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const { debit, credit } = await this.ledger.balanceOf('CUSTOMER', customerId, companyId);
    const balance = roundMoney(Number(customer.openingBalance) + debit - credit);

    const statements = await this.prisma.priceStatement.findMany({
      where: {
        customerId,
        status: { in: ['APPROVED', 'ARCHIVED'] },
        ...tenantWhere(companyId),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 5,
      select: { number: true, date: true, net: true, paymentTerm: true },
    });

    const phone = this.toWhatsAppPhone(customer.phone ?? customer.phone2);
    const text = this.buildMessage(customer.nameAr, balance, Number(customer.creditLimit), statements);

    return {
      url: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null,
      phone,
      text,
      balance,
    };
  }

  private buildMessage(
    nameAr: string,
    balance: number,
    creditLimit: number,
    statements: { number: string; date: Date; net: unknown; paymentTerm: string }[],
  ): string {
    const lines: string[] = [];
    lines.push(`*كشف حساب — ${nameAr}*`);
    lines.push(`الرصيد الحالي: ${balance}`);
    if (creditLimit > 0) lines.push(`حد الائتمان: ${creditLimit}`);
    if (statements.length > 0) {
      lines.push('');
      lines.push('*آخر الحركات:*');
      for (const s of statements) {
        const date = new Date(s.date).toISOString().slice(0, 10);
        lines.push(`• ${s.number} — ${date} — ${Number(s.net)}`);
      }
    }
    lines.push('');
    lines.push('شكراً لتواصلكم معنا.');
    return lines.join('\n');
  }

  /** تنسيق رقم الهاتف لصيغة wa.me الدولية (افتراضي مصر 20 عند البدء بصفر). */
  private toWhatsAppPhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    return digits;
  }
}
