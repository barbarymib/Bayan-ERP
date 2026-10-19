import 'package:flutter_test/flutter_test.dart';

import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/outbox.dart';
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

  group('isStaleDraft (R3-E4 §11)', () {
    StatementSummary at(String status, DateTime date) => StatementSummary(
          id: 1,
          number: 'BP-1',
          customerId: 1,
          date: date,
          status: status,
          net: 0,
        );
    final now = DateTime(2026, 10, 18);

    test('مسودة مضى عليها 5 أيام تُعدّ قديمة', () {
      expect(isStaleDraft(at('DRAFT', DateTime(2026, 10, 13)), now: now), isTrue);
    });

    test('مسودة حديثة لا تُعدّ قديمة', () {
      expect(isStaleDraft(at('DRAFT', DateTime(2026, 10, 17)), now: now), isFalse);
    });

    test('كشف معتمد لا يُعدّ قديماً مهما مضى', () {
      expect(isStaleDraft(at('APPROVED', DateTime(2026, 1, 1)), now: now), isFalse);
    });

    test('العتبة قابلة للتخصيص', () {
      expect(isStaleDraft(at('DRAFT', DateTime(2026, 10, 16)), now: now, days: 2), isTrue);
    });

    test('staleDraftCount يحصر المسودات القديمة فقط', () {
      final list = [
        at('DRAFT', DateTime(2026, 10, 13)),
        at('APPROVED', DateTime(2026, 10, 13)),
        at('DRAFT', DateTime(2026, 10, 18)),
      ];
      expect(staleDraftCount(list, now: now), 1);
    });
  });

  group('unifiedStatementRows (R3-F6 §8.2 #4)', () {
    final customers = [_cust(1, 'شركة النور'), _cust(2, 'مؤسسة الأمل')];

    OutboxItem local(
      String uuid,
      String? number,
      int customerId,
      String customerName,
      double net, {
      SyncStatus status = SyncStatus.local,
      DateTime? at,
    }) =>
        OutboxItem(
          clientUuid: uuid,
          type: 'price_statement',
          payload: {
            'number': number,
            'customerId': customerId,
            'customerName': customerName,
            'net': net,
          },
          number: number,
          createdAt: at ?? DateTime(2026, 10, 12),
          status: status,
        );

    test('يجمع كشوفات الخادم والمسودات المحلية فقط', () {
      final rows = unifiedStatementRows(
        statements: [_stmt(1, 'BP-1', 1, 'APPROVED', 100)],
        customers: customers,
        outbox: [
          local('u1', 'BP-L1', 2, 'مؤسسة الأمل', 50),
          OutboxItem(
            clientUuid: 'u2',
            type: 'collection',
            payload: const {},
            createdAt: DateTime(2026, 10, 13),
          ),
        ],
      );
      expect(rows.length, 2);
      expect(rows.where((r) => r.local).single.number, 'BP-L1');
    });

    test('يرتّب تنازلياً حسب التاريخ', () {
      final rows = unifiedStatementRows(
        statements: [_stmt(1, 'BP-1', 1, 'APPROVED', 100)],
        customers: customers,
        outbox: [local('u1', 'BP-L1', 2, 'مؤسسة الأمل', 50, at: DateTime(2026, 10, 15))],
      );
      expect(rows.first.number, 'BP-L1');
    });

    test('يُسقط العنصر المحلي المكرّر برقم موجود على الخادم', () {
      final rows = unifiedStatementRows(
        statements: [_stmt(1, 'BP-1', 1, 'DRAFT', 100)],
        customers: customers,
        outbox: [local('u1', 'BP-1', 1, 'شركة النور', 100)],
      );
      expect(rows.length, 1);
      expect(rows.single.local, isFalse);
    });

    test('تصنيف الحالات: مسودات/مرفوعة/معتمدة', () {
      final rows = unifiedStatementRows(
        statements: [
          _stmt(1, 'BP-1', 1, 'DRAFT', 10),
          _stmt(2, 'BP-2', 1, 'PENDING_REVIEW', 20),
          _stmt(3, 'BP-3', 1, 'APPROVED', 30),
          _stmt(4, 'BP-4', 1, 'CANCELLED', 40),
        ],
        customers: customers,
        outbox: [
          local('u1', 'BP-L1', 2, 'مؤسسة الأمل', 1),
          local('u2', 'BP-L2', 2, 'مؤسسة الأمل', 2, status: SyncStatus.pendingReview),
          local('u3', 'BP-L3', 2, 'مؤسسة الأمل', 3, status: SyncStatus.approved),
        ],
      );
      expect(rows.where((r) => r.bucket == StatementBucket.drafts).length, 2);
      expect(rows.where((r) => r.bucket == StatementBucket.uploaded).length, 2);
      expect(rows.where((r) => r.bucket == StatementBucket.approved).length, 2);
      expect(rows.where((r) => r.bucket == StatementBucket.other).length, 1);
    });

    test('الفلترة بالتصنيف والبحث بالاسم', () {
      final rows = unifiedStatementRows(
        statements: [
          _stmt(1, 'BP-1', 1, 'APPROVED', 10),
          _stmt(2, 'BP-2', 2, 'PENDING_REVIEW', 20),
        ],
        customers: customers,
        outbox: [local('u1', 'BP-L1', 2, 'مؤسسة الأمل', 5)],
      );
      expect(filterUnifiedStatements(rows, bucket: StatementBucket.uploaded).length, 1);
      expect(filterUnifiedStatements(rows, query: 'الأمل').length, 2);
      expect(
        filterUnifiedStatements(rows, bucket: StatementBucket.drafts, query: 'BP-L1').length,
        1,
      );
    });

    test('عدّ المسودات المحلية وإجمالي الصافي الموحّد', () {
      final rows = unifiedStatementRows(
        statements: [_stmt(1, 'BP-1', 1, 'APPROVED', 10)],
        customers: customers,
        outbox: [local('u1', 'BP-L1', 2, 'مؤسسة الأمل', 5, status: SyncStatus.uploaded)],
      );
      expect(localDraftCount(rows), 0);
      expect(totalUnifiedNet(rows), 15);
      expect(statementBucketLabel(StatementBucket.approved), 'معتمدة');
      expect(syncStatusLabel(SyncStatus.local), 'مسودّة محلية');
      expect(bucketForServerStatus('CANCELLED'), StatementBucket.other);
      expect(bucketForSyncStatus(SyncStatus.uploading), StatementBucket.drafts);
    });
  });
}
