import 'package:flutter_test/flutter_test.dart';

import 'package:bayan_rep/core/currency.dart';
import 'package:bayan_rep/core/models.dart';

void main() {
  group('currencyInfo (R3-A13 §3)', () {
    test('العملة الافتراضية جنيه مصري', () {
      expect(kDefaultCurrency, 'EGP');
      expect(currencyInfo(null).code, 'EGP');
      expect(currencyName(null), 'جنيه مصري');
      expect(currencySymbol('EGP'), 'ج.م');
    });

    test('يرجّع معلومات العملة المطلوبة (يتجاهل حالة الأحرف)', () {
      expect(currencyName('usd'), 'دولار أمريكي');
      expect(currencySymbol('SAR'), 'ر.س');
      expect(currencyInfo('KWD').decimalName, 'فلس');
    });

    test('رمز غير معروف يرجع للافتراضي', () {
      expect(currencyInfo('XXX').code, 'EGP');
      expect(currencyName(''), 'جنيه مصري');
    });
  });

  group('AuthUser.companyCurrency', () {
    test('يُقرأ ويُكتب في JSON', () {
      final u = AuthUser.fromJson(const {
        'id': 1,
        'name': 'مندوب',
        'roleCode': 'SALES_REP',
        'companyId': 2,
        'companyCurrency': 'SAR',
      });
      expect(u.companyCurrency, 'SAR');
      expect(u.toJson()['companyCurrency'], 'SAR');
    });

    test('غياب الحقل يعني null', () {
      final u = AuthUser.fromJson(const {'id': 1, 'name': 'مندوب', 'roleCode': 'SALES_REP'});
      expect(u.companyCurrency, isNull);
    });
  });
}
