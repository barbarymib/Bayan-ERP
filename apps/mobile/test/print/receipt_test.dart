import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/print/receipt.dart';
import 'package:flutter_test/flutter_test.dart';

OutboxItem _item(String type, Map<String, dynamic> payload, {String? number}) =>
    OutboxItem(
      clientUuid: 'uuid-1',
      type: type,
      payload: payload,
      number: number,
      createdAt: DateTime(2026, 10, 9, 12, 30),
    );

CustomerSummary _customer(int id, double balance) => CustomerSummary(
      id: id,
      code: 'C$id',
      name: 'عميل $id',
      phone: '0111',
      balance: balance,
    );

const _statementPayload = {
  'customerId': 7,
  'customerName': 'عميل 7',
  'number': 'BP-10',
  'headerDiscount': 5.0,
  'subtotal': 1000.0,
  'headerDiscountAmount': 50.0,
  'net': 950.0,
  'createdAt': '2026-10-09T12:00:00.000Z',
  'lines': [
    {
      'itemId': 3,
      'name': 'حديد',
      'qty': 10,
      'unitPrice': 100,
      'discountType': 'NONE',
      'discountValue': 0,
      'netFinal': 1000,
    },
  ],
};

const _receiptPayload = {
  'customerId': 7,
  'amount': 150.0,
  'method': 'CASH',
  'receivedAt': '2026-10-09T13:00:00.000Z',
  'notes': 'ملاحظة',
};

void main() {
  group('fmtMoney', () {
    test('فواصل الآلاف وخانتان عشريتان', () {
      expect(fmtMoney(1234.5), '1,234.50');
      expect(fmtMoney(1000000), '1,000,000.00');
      expect(fmtMoney(999.999), '1,000.00', reason: 'half-up ثم فواصل');
      expect(fmtMoney(0), '0.00');
      expect(fmtMoney(-1234.5), '-1,234.50');
      expect(fmtMoney(0.5), '0.50');
    });
  });

  group('fmtQty', () {
    test('بلا أصفار زائدة', () {
      expect(fmtQty(3), '3');
      expect(fmtQty(3.5), '3.5');
      expect(fmtQty(1.125), '1.125');
      expect(fmtQty(30), '30', reason: 'الأصفار الصحيحة تبقى');
    });
  });

  group('ReceiptDoc.forStatement', () {
    test('يبني العنوان والبنود والصافي والرصيد قبل/بعد', () {
      final doc = ReceiptDoc.forStatement(
        _item('price_statement', _statementPayload, number: 'BP-10'),
        ReceiptContext(
          customers: [_customer(7, 500)],
          repName: 'مندوب',
        ),
      );
      expect(doc.title, 'بيان أسعار');
      expect(doc.docNumber, 'BP-10');
      expect(doc.customerName, 'عميل 7');
      expect(doc.repName, 'مندوب');
      expect(doc.lines, hasLength(1));
      expect(doc.lines.first.name, 'حديد');
      expect(doc.lines.first.net, 1000);
      expect(doc.summary.map((r) => r.label), containsAll(['إجمالي البنود', 'الصافي']));
      expect(doc.summary.firstWhere((r) => r.label == 'الصافي').value, '950.00');
      expect(doc.summary.firstWhere((r) => r.label == 'الصافي').emphasis, isTrue);
      expect(doc.balanceBefore, 500);
      expect(doc.balanceAfter, 1450, reason: '500 + 950');
      expect(doc.dateLabel, contains('2026/10/09'));
    });

    test('خصم عام يظهر فقط إذا كان موجباً', () {
      final payload = {..._statementPayload, 'headerDiscountAmount': 0};
      final doc = ReceiptDoc.forStatement(
        _item('price_statement', payload),
        const ReceiptContext(),
      );
      expect(doc.summary.map((r) => r.label), isNot(contains('خصم عام')));
      expect(doc.balanceBefore, isNull, reason: 'عميل غير معروف ⇒ بلا رصيد');
    });
  });

  group('ReceiptDoc.forReceipt', () {
    test('المبلغ والطريقة والرصيد قبل/بعد', () {
      final doc = ReceiptDoc.forReceipt(
        _item('receipt', _receiptPayload, number: 'RC-5'),
        ReceiptContext(customers: [_customer(7, 500)]),
      );
      expect(doc.title, 'سند قبض');
      expect(doc.docNumber, 'RC-5');
      expect(doc.notes, 'ملاحظة');
      expect(doc.summary.firstWhere((r) => r.label == 'طريقة الدفع').value, 'نقداً');
      expect(doc.summary.firstWhere((r) => r.label == 'المبلغ').value, '150.00');
      expect(doc.balanceBefore, 500);
      expect(doc.balanceAfter, 350, reason: '500 - 150');
    });
  });

  group('ReceiptDoc.forReturn', () {
    test('يُستخرج اسم الصنف والسعر من البيان المصدر في DataStore', () {
      final statements = [
        StatementSummary(
          id: 1,
          number: 'BP-1',
          customerId: 7,
          date: DateTime(2026, 10, 1),
          status: 'APPROVED',
          net: 500,
          lines: [
            const StatementLineSummary(
              id: 11,
              itemId: 2,
              unitId: 1,
              qty: 5,
              qtyBase: 5,
              unitPrice: 100,
              netLine: 500,
            ),
          ],
        ),
      ];
      final payload = {
        'mode': 'BY_REP',
        'customerId': 7,
        'reasonCode': 'DAMAGED',
        'date': '2026-10-09T14:00:00.000Z',
        'lines': [
          {'sourceLineId': 11, 'qty': 2, 'condition': 'تالف'},
        ],
      };
      final doc = ReceiptDoc.forReturn(
        _item('return_statement', payload, number: 'RT-2'),
        ReceiptContext(
          customers: [_customer(7, 500)],
          statements: statements,
          items: const [ItemSummary(id: 2, code: 'A', name: 'سياج')],
        ),
      );
      expect(doc.title, 'مرتجع');
      expect(doc.docNumber, 'RT-2');
      expect(doc.lines, hasLength(1));
      expect(doc.lines.first.name, 'سياج');
      expect(doc.lines.first.qty, 2);
      expect(doc.lines.first.unitPrice, 100);
      expect(doc.lines.first.net, 200);
      expect(doc.summary.firstWhere((r) => r.label == 'قيمة المرتجع').value, '200.00');
      expect(doc.summary.firstWhere((r) => r.label == 'السبب').value, 'تالف');
      expect(doc.balanceBefore, 500);
      expect(doc.balanceAfter, 300, reason: '500 - 200');
    });

    test('بند مصدر محذوف ⇒ «بند محذوف» بلا سعر', () {
      final payload = {
        'mode': 'BY_REP',
        'customerId': 7,
        'reasonCode': 'EXPIRED',
        'date': '2026-10-09T14:00:00.000Z',
        'lines': [
          {'sourceLineId': 999, 'qty': 1, 'condition': 'تالف'},
        ],
      };
      final doc = ReceiptDoc.forReturn(
        _item('return_statement', payload),
        const ReceiptContext(),
      );
      expect(doc.lines.first.name, 'بند محذوف');
      expect(doc.summary.firstWhere((r) => r.label == 'السبب').value, 'منتهي الصلاحية');
    });
  });

  group('ReceiptDoc.fromOutboxItem', () {
    test('يوجّه حسب النوع ويتعامل مع النوع المجهول', () {
      final ctx = ReceiptContext(customers: [_customer(7, 100)]);
      expect(
        ReceiptDoc.fromOutboxItem(
          _item('price_statement', _statementPayload),
          ctx,
        ).title,
        'بيان أسعار',
      );
      expect(
        ReceiptDoc.fromOutboxItem(
          _item('receipt', _receiptPayload),
          ctx,
        ).title,
        'سند قبض',
      );
      final unknown = ReceiptDoc.fromOutboxItem(
        _item('other_type', const {}, number: 'X-1'),
        ctx,
      );
      expect(unknown.title, 'other_type');
      expect(unknown.docNumber, 'X-1');
    });

    test('fileNameBase يزيل الرموز غير الآمنة', () {
      final doc = ReceiptDoc.fromOutboxItem(
        _item('price_statement', {..._statementPayload, 'number': 'BP/12 3'}),
        ReceiptContext(),
      );
      expect(doc.fileNameBase.startsWith('bayan-'), isTrue);
      expect(RegExp(r'^bayan-[A-Za-z0-9_-]+$').hasMatch(doc.fileNameBase), isTrue);
    });
  });
}