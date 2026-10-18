import '../../core/models.dart';

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
