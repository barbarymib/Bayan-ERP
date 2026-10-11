import '../models.dart';
import '../outbox.dart';

/// تنسيق مبلغ مالي بفواصل الآلاف وخانتين عشريتين (مطابق لأسلوب نسخة الويب).
/// مثال: `1234.5` → `1,234.50`.
String fmtMoney(num value, {int decimals = 2}) {
  final negative = value < 0;
  final fixed = value.abs().toStringAsFixed(decimals);
  final dotIndex = fixed.indexOf('.');
  final intPart = dotIndex == -1 ? fixed : fixed.substring(0, dotIndex);
  final fracPart = dotIndex == -1 ? '' : fixed.substring(dotIndex + 1);
  final buffer = StringBuffer();
  for (var i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 == 0) buffer.write(',');
    buffer.write(intPart[i]);
  }
  final frac = fracPart.isEmpty ? '' : '.$fracPart';
  return '${negative ? '-' : ''}$buffer$frac';
}

/// تنسيق كمية (بدون فواصل، وحتى ثلاث خانات عشرية مع إزالة الأصفار الزائدة).
String fmtQty(num value) {
  var s = value.toStringAsFixed(3);
  if (s.contains('.')) {
    s = s.replaceFirst(RegExp(r'0+$'), '');
    s = s.replaceFirst(RegExp(r'\.$'), '');
  }
  return s;
}

/// بند مطبوع في المستند.
class ReceiptLine {
  final String name;
  final double qty;
  final String? unit;
  final double unitPrice;
  final double net;

  /// حالة البند (للمرتجعات: سليم/تالف…).
  final String? condition;

  const ReceiptLine({
    required this.name,
    required this.qty,
    this.unit,
    required this.unitPrice,
    required this.net,
    this.condition,
  });
}

/// صف ملخّص (تسمية/قيمة) أسفل المستند.
class ReceiptSummaryRow {
  final String label;
  final String value;
  final bool emphasis;

  const ReceiptSummaryRow({
    required this.label,
    required this.value,
    this.emphasis = false,
  });
}

/// مستند قابل للطباعة (حراري) أو التصدير PDF/واتساب — موحّد لكل الأنواع.
class ReceiptDoc {
  final String title;
  final String? docNumber;
  final DateTime date;
  final String? customerName;
  final String? customerCode;
  final String? customerPhone;
  final String? repName;
  final List<ReceiptLine> lines;
  final List<ReceiptSummaryRow> summary;
  final double? balanceBefore;
  final double? balanceAfter;
  final String? notes;
  final String footer;

  const ReceiptDoc({
    required this.title,
    this.docNumber,
    required this.date,
    this.customerName,
    this.customerCode,
    this.customerPhone,
    this.repName,
    this.lines = const [],
    this.summary = const [],
    this.balanceBefore,
    this.balanceAfter,
    this.notes,
    this.footer = 'شكراً لتعاملكم معنا',
  });

  String get dateLabel {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${date.year}/${two(date.month)}/${two(date.day)} '
        '${two(date.hour)}:${two(date.minute)}';
  }

  /// اسم ملف آمن للمشاركة (بلا أحرف عربية/رموز غير مسموحة).
  String get fileNameBase {
    final raw = docNumber ?? '';
    final safe = raw.replaceAll(RegExp(r'[^A-Za-z0-9_-]+'), '-');
    final stamp = date.millisecondsSinceEpoch;
    return safe.isEmpty ? 'bayan-$stamp' : 'bayan-$safe';
  }

  /// يبني المستند المناسب لنوع عنصر صندوق الصادر.
  static ReceiptDoc fromOutboxItem(OutboxItem item, ReceiptContext ctx) {
    switch (item.type) {
      case 'price_statement':
        return forStatement(item, ctx);
      case 'receipt':
        return forReceipt(item, ctx);
      case 'return_statement':
        return forReturn(item, ctx);
      default:
        return ReceiptDoc(
          title: item.type,
          docNumber: item.number,
          date: item.createdAt,
          repName: ctx.repName,
        );
    }
  }

  /// بيان أسعار (بنود + خصم عام + الصافي + الرصيد قبل/بعد).
  static ReceiptDoc forStatement(OutboxItem item, ReceiptContext ctx) {
    final p = item.payload;
    final net = _num(p['net']);
    final customer = _customer(ctx, p['customerId']);
    final lines = (p['lines'] as List? ?? const [])
        .map((e) => (e as Map).cast<String, dynamic>())
        .map((m) => ReceiptLine(
              name: (m['name'] ?? '').toString(),
              qty: _num(m['qty']),
              unitPrice: _num(m['unitPrice']),
              net: _num(m['netFinal']),
            ))
        .toList();
    final headerDiscount = _num(p['headerDiscountAmount']);
    final summary = <ReceiptSummaryRow>[
      ReceiptSummaryRow(label: 'إجمالي البنود', value: fmtMoney(_num(p['subtotal']))),
      if (headerDiscount > 0)
        ReceiptSummaryRow(label: 'خصم عام', value: fmtMoney(headerDiscount)),
      ReceiptSummaryRow(label: 'الصافي', value: fmtMoney(net), emphasis: true),
    ];
    final before = customer?.balance;
    return ReceiptDoc(
      title: 'بيان أسعار',
      docNumber: (p['number'] ?? item.number)?.toString(),
      date: _date(p['createdAt']) ?? item.createdAt,
      customerName: (p['customerName'] ?? customer?.name)?.toString(),
      customerCode: customer?.code,
      customerPhone: customer?.phone,
      repName: ctx.repName,
      lines: lines,
      summary: summary,
      balanceBefore: before,
      balanceAfter: before == null ? null : before + net,
    );
  }

  /// سند قبض (مبلغ/طريقة الدفع + الرصيد قبل/بعد).
  static ReceiptDoc forReceipt(OutboxItem item, ReceiptContext ctx) {
    final p = item.payload;
    final amount = _num(p['amount']);
    final customer = _customer(ctx, p['customerId']);
    final notes = p['notes']?.toString();
    final method = _methodLabel(p['method']?.toString());
    final summary = <ReceiptSummaryRow>[
      ReceiptSummaryRow(label: 'طريقة الدفع', value: method),
      ReceiptSummaryRow(label: 'المبلغ', value: fmtMoney(amount), emphasis: true),
    ];
    final before = customer?.balance;
    return ReceiptDoc(
      title: 'سند قبض',
      docNumber: item.number,
      date: _date(p['receivedAt']) ?? item.createdAt,
      customerName: customer?.name,
      customerCode: customer?.code,
      customerPhone: customer?.phone,
      repName: ctx.repName,
      summary: summary,
      balanceBefore: before,
      balanceAfter: before == null ? null : before - amount,
      notes: (notes == null || notes.trim().isEmpty) ? null : notes,
      footer: 'سند قبض — شكراً لتعاملكم معنا',
    );
  }

  /// مرتجع (بنود مُستنتجة من البيان المصدر عبر DataStore).
  static ReceiptDoc forReturn(OutboxItem item, ReceiptContext ctx) {
    final p = item.payload;
    final customer = _customer(ctx, p['customerId']);
    final lines = <ReceiptLine>[];
    var total = 0.0;
    for (final raw in (p['lines'] as List? ?? const [])) {
      final m = (raw as Map).cast<String, dynamic>();
      final source = _findStatementLine(ctx.statements, m['sourceLineId']);
      final qty = _num(m['qty']);
      final unitPrice = source?.unitPrice ?? 0;
      final net = qty * unitPrice;
      total += net;
      lines.add(ReceiptLine(
        name: source == null ? 'بند محذوف' : _itemName(ctx.items, source.itemId),
        qty: qty,
        unitPrice: unitPrice,
        net: net,
        condition: m['condition']?.toString(),
      ));
    }
    final reason = p['reasonCode']?.toString();
    final summary = <ReceiptSummaryRow>[
      if (reason != null && reason.isNotEmpty)
        ReceiptSummaryRow(label: 'السبب', value: _reasonLabel(reason)),
      ReceiptSummaryRow(label: 'قيمة المرتجع', value: fmtMoney(total), emphasis: true),
    ];
    final before = customer?.balance;
    return ReceiptDoc(
      title: 'مرتجع',
      docNumber: item.number,
      date: _date(p['date']) ?? item.createdAt,
      customerName: customer?.name,
      customerCode: customer?.code,
      customerPhone: customer?.phone,
      repName: ctx.repName,
      lines: lines,
      summary: summary,
      balanceBefore: before,
      balanceAfter: before == null ? null : before - total,
      footer: 'مرتجع بضاعة — شكراً لتعاملكم معنا',
    );
  }

  static CustomerSummary? _customer(ReceiptContext ctx, Object? id) {
    final cid = (id as num?)?.toInt();
    if (cid == null) return null;
    for (final c in ctx.customers) {
      if (c.id == cid) return c;
    }
    return null;
  }

  static StatementLineSummary? _findStatementLine(
    List<StatementSummary> statements,
    Object? id,
  ) {
    final lineId = (id as num?)?.toInt();
    if (lineId == null) return null;
    for (final s in statements) {
      for (final l in s.lines) {
        if (l.id == lineId) return l;
      }
    }
    return null;
  }

  static String _itemName(List<ItemSummary> items, int itemId) {
    for (final i in items) {
      if (i.id == itemId) return i.name;
    }
    return 'صنف #$itemId';
  }

  static double _num(Object? v) => (v as num?)?.toDouble() ?? 0;

  static DateTime? _date(Object? v) =>
      v == null ? null : DateTime.tryParse(v.toString());

  static String _methodLabel(String? m) {
    switch (m) {
      case 'CASH':
        return 'نقداً';
      case 'TRANSFER':
        return 'تحويل';
      case 'CHECK':
        return 'شيك';
      default:
        return m ?? '';
    }
  }

  static String _reasonLabel(String code) {
    switch (code) {
      case 'EXPIRED':
        return 'منتهي الصلاحية';
      case 'DAMAGED':
        return 'تالف';
      case 'WRONG_ITEM':
        return 'صنف خاطئ';
      case 'CUSTOMER_REFUSED':
        return 'رفض العميل';
      default:
        return code;
    }
  }
}

/// سياق البيانات المرجعية اللازم لإثراء المستند (أسماء العملاء/الصناف/البنود).
class ReceiptContext {
  final List<CustomerSummary> customers;
  final List<StatementSummary> statements;
  final List<ItemSummary> items;
  final String? repName;

  const ReceiptContext({
    this.customers = const [],
    this.statements = const [],
    this.items = const [],
    this.repName,
  });
}
