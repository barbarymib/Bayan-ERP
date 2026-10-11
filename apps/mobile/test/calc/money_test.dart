import 'package:bayan_rep/core/calc/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('roundMoney — half-up بعيداً عن الصفر', () {
    test('7437.625 ← 7437.63', () => expect(roundMoney(7437.625), 7437.63));
    test('4462.575 ← 4462.58', () => expect(roundMoney(4462.575), 4462.58));
    test('0.1 + 0.2 ← 0.3', () => expect(roundMoney(0.1 + 0.2), 0.3));
    test('-1.005 ← -1.01', () => expect(roundMoney(-1.005), -1.01));
  });

  group('roundQty — 3 خانات', () {
    test('10.6561 ← 10.656', () => expect(roundQty(10.6561), 10.656));
    test('1.0005 ← 1.001', () => expect(roundQty(1.0005), 1.001));
  });

  test('يرفض القيم غير المحدودة والضخمة', () {
    expect(() => roundMoney(double.infinity), throwsArgumentError);
    expect(() => roundMoney(double.nan), throwsArgumentError);
    expect(() => roundMoney(1e20), throwsArgumentError);
  });
}