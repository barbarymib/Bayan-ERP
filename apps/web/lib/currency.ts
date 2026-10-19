export const DEFAULT_CURRENCY = 'EGP';

export type CurrencyInfo = {
  code: string;
  symbol: string;
  nameAr: string;
  decimalName: string;
};

/** العملات المدعومة (§3: جنيه مصري افتراضياً، مع إمكانية إضافة عملة أخرى). */
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', decimalName: 'قرش' },
  { code: 'USD', symbol: '$', nameAr: 'دولار أمريكي', decimalName: 'سنت' },
  { code: 'EUR', symbol: '€', nameAr: 'يورو', decimalName: 'سنت' },
  { code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', decimalName: 'بنس' },
  { code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', decimalName: 'هللة' },
  { code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', decimalName: 'فلس' },
  { code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', decimalName: 'فلس' },
  { code: 'QAR', symbol: 'ر.ق', nameAr: 'ريال قطري', decimalName: 'درهم' },
  { code: 'JOD', symbol: 'د.أ', nameAr: 'دينار أردني', decimalName: 'قرش' },
];

/** معلومات عملة برمزها، مع الرجوع للافتراضي (EGP) عند رمز غير معروف. */
export function currencyInfo(code: string | null | undefined): CurrencyInfo {
  const wanted = (code ?? '').toUpperCase();
  return CURRENCIES.find((c) => c.code === wanted) ?? CURRENCIES[0];
}

let activeCode = DEFAULT_CURRENCY;

/** عملة الشركة الفعّالة الحالية (تُضبط من جلسة الدخول). */
export function activeCurrency(): string {
  return activeCode;
}

/** ضبط عملة الشركة الفعّالة عند تغيّر جلسة المستخدم. */
export function setActiveCurrency(code: string | null | undefined): void {
  activeCode = (code && code.trim()) || DEFAULT_CURRENCY;
}
