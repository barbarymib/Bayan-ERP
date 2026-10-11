import 'package:flutter_test/flutter_test.dart';

import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/features/statements/my_statements_view.dart';

CustomerSummary _cust(int id, String name, [double balance = 0, String code = '']) =>
    CustomerSummary(id: id, code: code.isEmpty ? 'C$id' : code, name: name, balance: balance);

StatementSummary _stmt(
  int id,
  String number,
  int customerId,
  String status,
  double net,
) =>
    StatementSummary(
      id: id,
      number: number,
      customerId: customerId,
      date: DateTime(2026, 10, 10),
      status: status,
      net: net,
    );

void main() {
  group('totalOutstanding / totalNet', () {
    test('يجمع الأرصدة الموجبة فقط', () {
      final customers = [
        _cust(1, 'أ', 100),
        _cust(2, 'ب', 0),
        _cust(3, 'ج', -50),
        _cust(4, 'د', 220.5),
      ];
      expect(totalOutstanding(customers), 320.5);
    });

    test('يجمع صافي الكشوفات', () {
      final stmts = [
        _stmt(1, 'BP-1', 1, 'APPROVED', 100),
        _stmt(2, 'BP-2', 1, 'APPROVED', 250.5),
      ];
      expect(totalNet(stmts), 350.5);
    });
  });

  group('customerNameById', () {
    final customers = [_cust(1, 'شركة النور'), _cust(2, 'مؤسسة الأمل')];

    test('يعيد اسم العميل', () {
      expect(customerNameById(customers, 2), 'مؤسسة الأمل');
    });

    test('يعيد نصاً فارغاً عند الغياب', () {
      expect(customerNameById(customers, 99), '');
    });
  });

  group('balancesSorted', () {
    test('يرتّب تنازلياً حسب الرصيد', () {
      final rows = balancesSorted([
        _cust(1, 'أ', 50),
        _cust(2, 'ب', 300),
        _cust(3, 'ج', 120),
      ]);
      expect(rows.map((r) => r.customerId), [2, 3, 1]);
    });

    test('عند تساوي الرصيد يرتّب بالاسم', () {
      final rows = balancesSorted([
        _cust(1, 'ب', 100),
        _cust(2, 'أ', 100),
      ]);
      expect(rows.map((r) => r.name), ['أ', 'ب']);
    });
  });

  group('filterStatements', () {
    final customers = [_cust(1, 'شركة النور'), _cust(2, 'مؤسسة الأمل')];
    final stmts = [
      _stmt(1, 'BP-000001', 1, 'APPROVED', 100),
      _stmt(2, 'BP-000002', 2, 'PENDING_REVIEW', 200),
      _stmt(3, 'BP-000003', 1, 'APPROVED', 300),
    ];

    test('بلا فلتر يعيد الكل', () {
      expect(filterStatements(stmts, customers).length, 3);
    });

    test('الفلترة بالحالة', () {
      final r = filterStatements(stmts, customers, status: 'APPROVED');
      expect(r.map((s) => s.id), [1, 3]);
    });

    test('البحث باسم العميل', () {
      final r = filterStatements(stmts, customers, query: 'الأمل');
      expect(r.map((s) => s.id), [2]);
    });

    test('البحث برقم البيان', () {
      final r = filterStatements(stmts, customers, query: 'BP-000003');
      expect(r.single.id, 3);
    });

    test('البحث + الحالة معاً', () {
      final r = filterStatements(stmts, customers, status: 'APPROVED', query: 'النور');
      expect(r.map((s) => s.id), [1, 3]);
    });
  });

  group('statementStatusLabel', () {
    test('الترجمة العربية للحالات المعروفة', () {
      expect(statementStatusLabel('APPROVED'), 'معتمد');
      expect(statementStatusLabel('PENDING_REVIEW'), 'بانتظار المراجعة');
      expect(statementStatusLabel('CANCELLED'), 'ملغى');
    });

    test('حالة غير معروفة تُرجَع كما هي', () {
      expect(statementStatusLabel('WEIRD'), 'WEIRD');
    });
  });
}
