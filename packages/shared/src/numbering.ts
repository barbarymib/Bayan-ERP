/**
 * ترقيم آمن للعمل أوفلاين.
 *
 * الصيغة: {بادئة}-{كود المندوب}-{تسلسل}
 * مثال:  BP-M03-000127
 *
 * البادئات:
 *  BP = بيان أسعار   PR = بيان توريد   RT = بيان مرتجع
 *  RC = سند قبض      PV = سند صرف      ST = جلسة جرد
 *  QT = عرض سعر
 *
 * لتفادي التعارض عند الإصدار أوفلاين: لكل جهاز/مندوب يُحجز
 * "كتلة أرقام" مسبقاً من الخادم، ولا يُصدر الجهاز خارج كتلته.
 */

export type DocPrefix = 'BP' | 'PR' | 'RT' | 'RC' | 'PV' | 'ST' | 'QT' | 'TR' | 'PO' | 'SR' | 'CH';

export const DOC_PREFIXES: Record<DocPrefix, string> = {
  BP: 'بيان أسعار',
  PR: 'بيان توريد',
  RT: 'بيان مرتجع',
  RC: 'سند قبض',
  PV: 'سند صرف',
  ST: 'جلسة جرد',
  QT: 'عرض سعر',
  TR: 'تحويل مخزني',
  PO: 'أمر شراء',
  SR: 'مرتجع مشتريات',
  CH: 'محضر تسليم عهدة',
};

export const SEQUENCE_WIDTH = 6;
export const DEFAULT_BLOCK_SIZE = 100;

export interface NumberBlock {
  prefix: DocPrefix;
  /** كود المندوب/الجهاز — فارغ للمكتب */
  ownerCode: string;
  /** أول رقم متاح في الكتلة */
  from: number;
  /** آخر رقم متاح (شامل) */
  to: number;
}

export function formatDocNumber(prefix: DocPrefix, ownerCode: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid sequence: ${sequence}`);
  }
  const seq = String(sequence).padStart(SEQUENCE_WIDTH, '0');
  return ownerCode ? `${prefix}-${ownerCode}-${seq}` : `${prefix}-${seq}`;
}

/** حجز كتلة أرقام جديدة بعد آخر كتلة (يستدعي الخادم عند اقتراب النفاد). */
export function reserveNextBlock(
  prefix: DocPrefix,
  ownerCode: string,
  lastReservedTo: number | null,
  blockSize: number = DEFAULT_BLOCK_SIZE,
): NumberBlock {
  if (blockSize < 1) throw new Error('blockSize must be >= 1');
  const from = (lastReservedTo ?? 0) + 1;
  return { prefix, ownerCode, from, to: from + blockSize - 1 };
}

export function nextSequenceInBlock(block: NumberBlock, lastUsed: number | null): number {
  const next = (lastUsed ?? block.from - 1) + 1;
  if (next > block.to) {
    throw new Error(
      `Number block exhausted for ${formatDocNumber(block.prefix, block.ownerCode, block.from)}..${block.to}`,
    );
  }
  return next;
}

export function isSequenceInBlock(block: NumberBlock, sequence: number): boolean {
  return sequence >= block.from && sequence <= block.to;
}
