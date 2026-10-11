import 'package:bayan_rep/core/connectivity.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('connectivityIsOnline', () {
    test('لا اتصال عندما تكون النتيجة none فقط', () {
      expect(connectivityIsOnline([ConnectivityResult.none]), isFalse);
    });

    test('متصل عند أي واجهة غير none', () {
      expect(connectivityIsOnline([ConnectivityResult.wifi]), isTrue);
      expect(connectivityIsOnline([ConnectivityResult.mobile]), isTrue);
    });

    test('متصل عند وجود واجهة فعلية ضمن قائمة', () {
      expect(
        connectivityIsOnline([ConnectivityResult.none, ConnectivityResult.ethernet]),
        isTrue,
      );
    });
  });
}
