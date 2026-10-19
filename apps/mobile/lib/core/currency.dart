/// عملة الشركة (§3، R3-A13): جنيه مصري افتراضياً، مع إمكانية إضافة عملة أخرى.
class CurrencyInfo {
  final String code;
  final String symbol;
  final String nameAr;
  final String decimalName;

  const CurrencyInfo({
    required this.code,
    required this.symbol,
    required this.nameAr,
    required this.decimalName,
  });
}

/// العملة الافتراضية عند غياب إعداد صريح.
const String kDefaultCurrency = 'EGP';

/// العملات المدعومة (مطابقة لنسخة الويب).
const List<CurrencyInfo> kCurrencies = [
  CurrencyInfo(code: 'EGP', symbol: 'ج.م', nameAr: 'جنيه مصري', decimalName: 'قرش'),
  CurrencyInfo(code: 'USD', symbol: r'$', nameAr: 'دولار أمريكي', decimalName: 'سنت'),
  CurrencyInfo(code: 'EUR', symbol: '€', nameAr: 'يورو', decimalName: 'سنت'),
  CurrencyInfo(code: 'GBP', symbol: '£', nameAr: 'جنيه إسترليني', decimalName: 'بنس'),
  CurrencyInfo(code: 'SAR', symbol: 'ر.س', nameAr: 'ريال سعودي', decimalName: 'هللة'),
  CurrencyInfo(code: 'AED', symbol: 'د.إ', nameAr: 'درهم إماراتي', decimalName: 'فلس'),
  CurrencyInfo(code: 'KWD', symbol: 'د.ك', nameAr: 'دينار كويتي', decimalName: 'فلس'),
  CurrencyInfo(code: 'QAR', symbol: 'ر.ق', nameAr: 'ريال قطري', decimalName: 'درهم'),
  CurrencyInfo(code: 'JOD', symbol: 'د.أ', nameAr: 'دينار أردني', decimalName: 'قرش'),
];

/// معلومات عملة برمزها، مع الرجوع للافتراضي عند رمز غير معروف.
CurrencyInfo currencyInfo(String? code) {
  final wanted = (code ?? '').toUpperCase();
  for (final c in kCurrencies) {
    if (c.code == wanted) return c;
  }
  return kCurrencies.first;
}

/// رمز عملة مختصر (مثال: ج.م).
String currencySymbol(String? code) => currencyInfo(code).symbol;

/// الاسم العربي للعملة (مثال: جنيه مصري).
String currencyName(String? code) => currencyInfo(code).nameAr;
