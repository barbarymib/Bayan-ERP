import '../../core/models.dart';
import '../../core/outbox.dart';

/// صفّ رصيد عميل (لعرض الأرصدة مرتّبة).
class BalanceRow {
  final int customerId;
  final String name;
  final String code;
  final double balance;

  const BalanceRow({
    required this.customerId,
    required this.name,
    required this.code,
    required this.balance,
  });
}

/// إجمالي المديونية المستحقّة على العملاء (الأرصدة الموجبة فقط).
double totalOutstanding(List<CustomerSummary> customers) =>
    customers.fold(0.0, (s, c) => s + (c.balance > 0 ? c.balance : 0));

/// إجمالي صافي الكشوفات.
double totalNet(List<StatementSummary> statements) =>
    statements.fold(0.0, (s, st) => s + st.net);

/// اسم العميل بالمعرّف، أو '' إن لم يوجد.
String customerNameById(List<CustomerSummary> customers, int id) {
  for (final c in customers) {
    if (c.id == id) return c.name;
  }
  return '';
}

/// أرصدة العملاء مرتّبة تنازلياً حسب الرصيد (والاسم عند التساوي).
List<BalanceRow> balancesSorted(List<CustomerSummary> customers) {
  final rows = customers
      .map((c) => BalanceRow(
            customerId: c.id,
            name: c.name,
            code: c.code,
            balance: c.balance,
          ))
      .toList()
    ..sort((a, b) {
      final byBalance = b.balance.compareTo(a.balance);
      return byBalance != 0 ? byBalance : a.name.compareTo(b.name);
    });
  return rows;
}

/// يرشّح الكشوفات بالحالة (فارغ = الكل) وبحث نصّي في رقم البيان أو اسم العميل.
List<StatementSummary> filterStatements(
  List<StatementSummary> statements,
  List<CustomerSummary> customers, {
  String? status,
  String query = '',
}) {
  final q = query.trim().toLowerCase();
  return statements.where((s) {
    if (status != null && status.isNotEmpty && s.status != status) return false;
    if (q.isEmpty) return true;
    if (s.number.toLowerCase().contains(q)) return true;
    return customerNameById(customers, s.customerId).toLowerCase().contains(q);
  }).toList();
}

/// التسمية العربية لحالة بيان.
String statementStatusLabel(String status) {
  switch (status) {
    case 'APPROVED':
      return 'معتمد';
    case 'PENDING_REVIEW':
      return 'بانتظار المراجعة';
    case 'CANCELLED':
      return 'ملغى';
    case 'DRAFT':
      return 'مسودّة';
    default:
      return status;
  }
}

/// عتبة «المسودة القديمة» بالأيام — تحذير بتغيّر الأسعار (§11).
const int kStaleDraftDays = 3;

/// هل الحالة مسودة/بانتظار مراجعة؟
bool isDraftStatus(String status) => status == 'DRAFT' || status == 'PENDING_REVIEW';

/// هل الكشف مسودة قديمة (مضى على تاريخه [days] يوماً دون اعتماد)؟
bool isStaleDraft(
  StatementSummary s, {
  DateTime? now,
  int days = kStaleDraftDays,
}) {
  if (!isDraftStatus(s.status)) return false;
  final ref = now ?? DateTime.now();
  return ref.difference(s.date).inDays >= days;
}

/// عدد الكشوفات المسودّة القديمة في القائمة.
int staleDraftCount(List<StatementSummary> statements, {DateTime? now, int days = kStaleDraftDays}) =>
    statements.where((s) => isStaleDraft(s, now: now, days: days)).length;

/// تصنيف «بياناتي» الموحّد (§8.2 #4): مسودات / مرفوعة / معتمدة.
enum StatementBucket { drafts, uploaded, approved, other }

/// التسمية العربية لتصنيف الكشف.
String statementBucketLabel(StatementBucket b) {
  switch (b) {
    case StatementBucket.drafts:
      return 'مسودات';
    case StatementBucket.uploaded:
      return 'مرفوعة';
    case StatementBucket.approved:
      return 'معتمدة';
    case StatementBucket.other:
      return 'أخرى';
  }
}

/// تصنيف كشف موجود على الخادم حسب حالته.
StatementBucket bucketForServerStatus(String status) {
  switch (status) {
    case 'DRAFT':
      return StatementBucket.drafts;
    case 'PENDING_REVIEW':
      return StatementBucket.uploaded;
    case 'APPROVED':
      return StatementBucket.approved;
    default:
      return StatementBucket.other;
  }
}

/// تصنيف كشف محلي حسب حالة مزامنته.
StatementBucket bucketForSyncStatus(SyncStatus status) {
  switch (status) {
    case SyncStatus.approved:
      return StatementBucket.approved;
    case SyncStatus.uploaded:
    case SyncStatus.pendingReview:
      return StatementBucket.uploaded;
    case SyncStatus.local:
    case SyncStatus.uploading:
      return StatementBucket.drafts;
    case SyncStatus.rejected:
      return StatementBucket.other;
  }
}

/// التسمية العربية لحالة مزامنة كشف محلي.
String syncStatusLabel(SyncStatus status) {
  switch (status) {
    case SyncStatus.local:
      return 'مسودّة محلية';
    case SyncStatus.uploading:
      return 'جارٍ الرفع';
    case SyncStatus.uploaded:
      return 'مرفوعة';
    case SyncStatus.pendingReview:
      return 'بانتظار المراجعة';
    case SyncStatus.approved:
      return 'معتمد';
    case SyncStatus.rejected:
      return 'مرفوض';
  }
}

/// صفّ موحّد يجمع كشوفات الخادم والمحلية غير المرفوعة.
class UnifiedStatementRow {
  final String number;
  final String customerName;
  final DateTime date;
  final double net;
  final StatementBucket bucket;
  final String statusLabel;
  final bool local;

  const UnifiedStatementRow({
    required this.number,
    required this.customerName,
    required this.date,
    required this.net,
    required this.bucket,
    required this.statusLabel,
    required this.local,
  });
}

/// يبني صفوف «بياناتي» الموحّدة: كشوفات الخادم + ما في صندوق الصادر من كشوفات.
/// تُهمَل العناصر المحلية المكرّرة (سبق رفعها وظهرت ضمن بيانات الخادم) برقمها.
List<UnifiedStatementRow> unifiedStatementRows({
  required List<StatementSummary> statements,
  required List<CustomerSummary> customers,
  required List<OutboxItem> outbox,
}) {
  final rows = <UnifiedStatementRow>[];
  final serverNumbers = <String>{};
  for (final s in statements) {
    if (s.number.isNotEmpty) serverNumbers.add(s.number);
    rows.add(UnifiedStatementRow(
      number: s.number,
      customerName: customerNameById(customers, s.customerId),
      date: s.date,
      net: s.net,
      bucket: bucketForServerStatus(s.status),
      statusLabel: statementStatusLabel(s.status),
      local: false,
    ));
  }
  for (final i in outbox) {
    if (i.type != 'price_statement') continue;
    final number = i.number ?? (i.payload['number'] as String? ?? '');
    if (number.isNotEmpty && serverNumbers.contains(number)) continue;
    final customerId = (i.payload['customerId'] as num?)?.toInt();
    final name = (i.payload['customerName'] as String?) ??
        (customerId == null ? '' : customerNameById(customers, customerId));
    rows.add(UnifiedStatementRow(
      number: number,
      customerName: name,
      date: i.createdAt,
      net: ((i.payload['net'] as num?) ?? 0).toDouble(),
      bucket: bucketForSyncStatus(i.status),
      statusLabel: syncStatusLabel(i.status),
      local: true,
    ));
  }
  rows.sort((a, b) {
    final byDate = b.date.compareTo(a.date);
    return byDate != 0 ? byDate : a.number.compareTo(b.number);
  });
  return rows;
}

/// يرشّح صفوف «بياناتي» بالتصنيف (فارغ = الكل) وبحث نصّي في الرقم أو اسم العميل.
List<UnifiedStatementRow> filterUnifiedStatements(
  List<UnifiedStatementRow> rows, {
  StatementBucket? bucket,
  String query = '',
}) {
  final q = query.trim().toLowerCase();
  return rows.where((r) {
    if (bucket != null && r.bucket != bucket) return false;
    if (q.isEmpty) return true;
    if (r.number.toLowerCase().contains(q)) return true;
    return r.customerName.toLowerCase().contains(q);
  }).toList();
}

/// عدد الكشوفات المحلية التي لم تُرفع بعد.
int localDraftCount(List<UnifiedStatementRow> rows) =>
    rows.where((r) => r.local && r.bucket == StatementBucket.drafts).length;

/// مجموع صافي كل صفوف «بياناتي» الموحّدة.
double totalUnifiedNet(List<UnifiedStatementRow> rows) =>
    rows.fold(0.0, (s, r) => s + r.net);
