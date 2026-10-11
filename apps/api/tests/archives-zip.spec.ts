import { describe, expect, it } from 'vitest';
import { createZip, crc32, sha256, toCsv, type ZipEntry } from '../src/archives/zip.js';

describe('crc32', () => {
  it('matches the known vector for "123456789"', () => {
    expect(crc32(Buffer.from('123456789', 'utf8'))).toBe(0xcbf43926);
  });

  it('empty input is 0', () => {
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('toCsv', () => {
  it('writes a UTF-8 BOM so Excel opens Arabic correctly', () => {
    expect(toCsv([]).startsWith('﻿')).toBe(true);
    expect(toCsv([{ a: 1 }]).startsWith('﻿')).toBe(true);
  });

  it('escapes quotes, commas and newlines', () => {
    const csv = toCsv([{ name: 'أحمد, "علي"', note: 'سطر\nآخر' }]);
    expect(csv).toContain('"أحمد, ""علي"""');
    expect(csv).toContain('"سطر\nآخر"');
  });

  it('unions columns across rows and leaves blanks', () => {
    const csv = toCsv([{ a: 1, b: 2 }, { b: 3, c: 4 }]);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('a,b,c');
    expect(lines[1]).toBe('1,2,');
    expect(lines[2]).toBe(',3,4');
  });
});

describe('sha256', () => {
  it('hashes to the canonical digest', () => {
    expect(sha256(Buffer.from('bayan'))).toBe(
      '59887cb43aa2a2e12e6d21cb337aa6e4210ae65980f0acbe4e8814c4272ebc43',
    );
  });
});

describe('createZip', () => {
  const entries: ZipEntry[] = [
    { name: 'AR-000001/manifest.json', data: Buffer.from('{"code":"AR-000001"}', 'utf8') },
    { name: 'AR-000001/data.json', data: Buffer.from(JSON.stringify({ rows: [1, 2, 3] }), 'utf8') },
    { name: 'AR-000001/price_statements.csv', data: Buffer.from('﻿id,net\n1,100', 'utf8') },
  ];

  it('builds a structurally valid store-method zip', () => {
    const zip = createZip(entries);
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304'); // PK\x03\x04
    expect(zip.subarray(zip.length - 22, zip.length - 18).toString('hex')).toBe('504b0506'); // EOCD
    const eocdEntries = zip.readUInt16LE(zip.length - 12);
    expect(eocdEntries).toBe(3);
    for (const e of entries) expect(zip.includes(Buffer.from(e.name, 'utf8'))).toBe(true);
  });

  it('is deterministic for identical input', () => {
    expect(sha256(createZip(entries))).toBe(sha256(createZip(entries.map((e) => ({ ...e })))));
  });

  it('local headers carry correct CRC and sizes (verifiable without unzip)', () => {
    const first = entries[0]!;
    const zip = createZip([first]);
    expect(zip.readUInt32LE(14)).toBe(crc32(first.data)); // CRC
    expect(zip.readUInt32LE(18)).toBe(first.data.length); // compressed
    expect(zip.readUInt32LE(22)).toBe(first.data.length); // uncompressed
    const nameLen = zip.readUInt16LE(26);
    const dataStart = 30 + nameLen;
    expect(zip.subarray(dataStart, dataStart + first.data.length).equals(first.data)).toBe(true);
  });

  it('central directory offsets point at local headers', () => {
    const zip = createZip(entries);
    const eocdOffset = zip.length - 22;
    const cdOffset = zip.readUInt32LE(eocdOffset + 16);
    expect(zip.readUInt32LE(cdOffset)).toBe(0x02014b50); // central dir signature
    const localOffset = zip.readUInt32LE(cdOffset + 42);
    expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50);
  });
});
