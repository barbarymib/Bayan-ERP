import { describe, expect, it } from 'vitest';
import { recordsToSheet, toXlsx, type XlsxSheet } from '../src/common/xlsx.js';

function contains(buf: Buffer, text: string): boolean {
  return buf.includes(Buffer.from(text, 'utf8'));
}

describe('toXlsx — مصنّف Excel بلا اعتماديات خارجية (§5.14/§5.11)', () => {
  const sheet: XlsxSheet = {
    name: 'report',
    headers: ['الصنف', 'qty', 'value'],
    rows: [
      ['حديد', 10, 330],
      ['مواسير', 1, 110],
    ],
  };

  it('ينتج ملف ZIP صالح (توقيع PK + EOCD)', () => {
    const buf = toXlsx([sheet]);
    expect(buf.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(buf.subarray(buf.length - 22, buf.length - 18).toString('hex')).toBe('504b0506');
  });

  it('يتضمن أجزاء OOXML المطلوبة', () => {
    const buf = toXlsx([sheet]);
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(contains(buf, part)).toBe(true);
    }
  });

  it('يكتب النص خلية inlineStr والأرقام خلايا رقمية', () => {
    const buf = toXlsx([sheet]);
    expect(contains(buf, '<t xml:space="preserve">حديد</t>')).toBe(true);
    expect(contains(buf, '<c r="B2"><v>10</v></c>')).toBe(true);
    expect(contains(buf, '<c r="C3"><v>110</v></c>')).toBe(true);
  });

  it('يضبط اتجاه الورقة RTL', () => {
    const buf = toXlsx([sheet]);
    expect(contains(buf, 'rightToLeft="1"')).toBe(true);
  });

  it('يدعم أوراقاً متعددة', () => {
    const buf = toXlsx([sheet, { name: 'ثانية', headers: ['a'], rows: [[1]] }]);
    expect(contains(buf, 'xl/worksheets/sheet2.xml')).toBe(true);
    expect(contains(buf, 'sheetId="2"')).toBe(true);
  });

  it('ينظّف اسم الورقة (محارف ممنوعة + طول 31)', () => {
    const buf = toXlsx([{ name: 'a/b:c*?' + 'x'.repeat(50), headers: ['h'], rows: [] }]);
    expect(contains(buf, 'name="a b c')).toBe(true);
    expect(contains(buf, '/b:c*?')).toBe(false);
  });

  it('يهرّب محارف XML في النصوص', () => {
    const buf = toXlsx([{ name: 's', headers: ['h'], rows: [['a<b>&"c']] }]);
    expect(contains(buf, 'a&lt;b&gt;&amp;&quot;c')).toBe(true);
  });

  it('يتعامل مع أوراق فارغة', () => {
    const buf = toXlsx([{ name: 'empty', headers: [], rows: [] }]);
    expect(buf.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});

describe('recordsToSheet', () => {
  it('يوحّد الأعمدة عبر السجلات', () => {
    const sheet = recordsToSheet('t', [{ a: 1, b: 2 }, { b: 3, c: 4 }]);
    expect(sheet.headers).toEqual(['a', 'b', 'c']);
    expect(sheet.rows).toEqual([
      [1, 2, ''],
      ['', 3, 4],
    ]);
  });

  it('يحوّل التواريخ لـ ISO والكائنات لـ JSON', () => {
    const d = new Date('2026-10-13T00:00:00.000Z');
    const sheet = recordsToSheet('t', [{ d, obj: { x: 1 }, nil: null }]);
    expect(sheet.rows[0]).toEqual(['2026-10-13T00:00:00.000Z', '{"x":1}', '']);
  });
});
