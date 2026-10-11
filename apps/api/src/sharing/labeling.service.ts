import { Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import bwipjs from 'bwip-js';
import { PrismaService } from '../prisma/prisma.module.js';
import { tenantWhere } from '../common/tenant.js';

/** ترميز QR موحّد: كود الصنف/العميل كما هو (قابل للبحث في التطبيق). */
@Injectable()
export class LabelingService {
  constructor(private readonly prisma: PrismaService) {}

  async itemQr(code: string, companyId: number | null = null): Promise<string> {
    const item = await this.prisma.item.findFirst({
      where: { code, ...tenantWhere(companyId) },
      select: { code: true },
    });
    if (!item) throw new NotFoundException(`Item ${code} not found`);
    return this.qrSvg(item.code);
  }

  async customerQr(code: string, companyId: number | null = null): Promise<string> {
    const customer = await this.prisma.customer.findFirst({
      where: { code, ...tenantWhere(companyId) },
      select: { code: true },
    });
    if (!customer) throw new NotFoundException(`Customer ${code} not found`);
    return this.qrSvg(customer.code);
  }

  /** باركود الصنف (Code128): يفضَّل الباركود المسجَّل وإلا كود الصنف. */
  async itemBarcode(code: string, companyId: number | null = null): Promise<string> {
    const item = await this.prisma.item.findFirst({
      where: { code, ...tenantWhere(companyId) },
      select: { code: true, barcode: true },
    });
    if (!item) throw new NotFoundException(`Item ${code} not found`);
    const text = item.barcode ?? item.code;
    return bwipjs.toSVG({
      bcid: 'code128',
      text,
      scale: 2,
      height: 10,
      includetext: true,
      textxalign: 'center',
      padding: 2,
    });
  }

  private qrSvg(text: string): Promise<string> {
    return QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
}
