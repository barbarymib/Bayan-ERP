const ONES = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
const THOUSAND = ['', 'ألف', 'ألفان', 'آلاف'];
const MILLION = ['', 'مليون', 'مليونان', 'ملايين'];

function base(units: number, tensDigit: number, over20: boolean): string {
  if (over20) {
    const u = ONES[units] ?? '';
    return [u, TENS[tensDigit] ?? ''].filter(Boolean).join(' و');
  }
  if (units === 1) return 'واحد';
  return ONES[units] ?? '';
}

function hundreds(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return '';
  if (r === 0) return HUNDREDS[h] ?? '';
  if (h === 1) return `مئة و${two(r)}`;
  if (h === 2) return `مئتان و${two(r)}`;
  if (r === 2) return `${HUNDREDS[h]} واثنان`;
  return `${HUNDREDS[h]} و${two(r)}`;
}

function two(n: number): string {
  if (n === 0) return '';
  if (n < 10) return ONES[n] ?? '';
  if (n < 20) return TEENS[n - 10] ?? '';
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const t = TENS[tens] ?? '';
  const u = base(units, tens, true);
  if (units === 0) return t;
  return `${u} و${t}`;
}

function group(n: number): string {
  if (n === 0) return '';
  if (n < 100) return two(n);
  return hundreds(n);
}

/** تحويل عدد صحيح إلى كلمات عربية حتى التريليونات. */
export function numberToArabic(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs === 0) return 'صفر';
  const parts: string[] = [];
  let remaining = abs;
  const THOUSANDS = 1000;
  const MILLIONS = 1000000;
  const BILLIONS = 1000000000;
  const TRILLIONS = 1000000000000;

  const tri = Math.floor(remaining / TRILLIONS);
  remaining %= TRILLIONS;
  const bil = Math.floor(remaining / BILLIONS);
  remaining %= BILLIONS;
  const mil = Math.floor(remaining / MILLIONS);
  remaining %= MILLIONS;
  const th = Math.floor(remaining / THOUSANDS);
  remaining %= THOUSANDS;

  const plural = (count: number, forms: string[]): string => {
    if (count === 2) return forms[2];
    if (count >= 3 && count <= 10) return forms[3];
    return forms[1];
  };

  if (tri > 0) parts.push(`${group(tri)} تريليون${tri === 2 ? 'ان' : ''}`);
  if (bil > 0) parts.push(`${group(bil)} مليار${bil === 2 ? 'ان' : ''}`);
  if (mil > 0) parts.push(`${group(mil)} ${plural(mil, MILLION)}`);
  if (th > 0) parts.push(`${group(th)} ${plural(th, THOUSAND)}`);
  if (remaining > 0) parts.push(group(remaining));

  const text = parts.join(' و');
  return n < 0 ? `سالب ${text}` : text;
}

/** تحويل مبلغ إلى كلمات عربية مع الجزء العشري (فردة). */
export function formatArabicAmount(amount: number, currency = 'ج.م', decimalName = 'قرش'): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.floor(Math.abs(rounded));
  const frac = Math.round((Math.abs(rounded) - whole) * 100);
  const sign = rounded < 0 ? 'سالب ' : '';
  const w = numberToArabic(whole);
  if (frac === 0) return `${sign}${w} ${currency} فقط لا غير`;
  return `${sign}${w} ${currency} و${numberToArabic(frac)} ${decimalName} فقط لا غير`;
}