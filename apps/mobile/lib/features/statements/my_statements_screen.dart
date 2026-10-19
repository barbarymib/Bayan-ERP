import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/print/receipt.dart';
import '../../core/providers.dart';
import 'my_statements_view.dart';

/// شاشة «بياناتي» (§5.12): كشوفات المندوب وأرصدة عملائه من البيانات المنزّلة.
class MyStatementsScreen extends ConsumerStatefulWidget {
  const MyStatementsScreen({super.key});

  @override
  ConsumerState<MyStatementsScreen> createState() => _MyStatementsScreenState();
}

class _MyStatementsScreenState extends ConsumerState<MyStatementsScreen> {
  String _query = '';
  StatementBucket? _bucket;

  static const _buckets = <StatementBucket?>[
    null,
    StatementBucket.drafts,
    StatementBucket.uploaded,
    StatementBucket.approved,
  ];

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(dataStoreProvider);
    final outbox = ref.watch(outboxProvider).all;
    final allRows = unifiedStatementRows(
      statements: store.statements,
      customers: store.customers,
      outbox: outbox,
    );
    final rows = filterUnifiedStatements(allRows, bucket: _bucket, query: _query);
    final balances = balancesSorted(store.customers);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('بياناتي')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCards(allRows, store.customers),
          if (staleDraftCount(store.statements) > 0) ...[
            const SizedBox(height: 8),
            _staleBanner(staleDraftCount(store.statements)),
          ],
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              labelText: 'بحث برقم البيان أو اسم العميل',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final b in _buckets)
                ChoiceChip(
                  label: Text(b == null ? 'الكل' : statementBucketLabel(b)),
                  selected: _bucket == b,
                  onSelected: (_) => setState(() => _bucket = b),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text('الكشوفات (${rows.length})',
              style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          if (allRows.isEmpty)
            _emptyCard('لا توجد كشوفات. نزّل البيانات ثم أعد المحاولة.')
          else if (rows.isEmpty)
            _emptyCard('لا توجد نتائج مطابقة.')
          else
            for (final r in rows) _unifiedTile(context, r),
          const SizedBox(height: 16),
          Text('أرصدة العملاء (${balances.length})',
              style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          if (balances.isEmpty)
            _emptyCard('لا توجد أرصدة.')
          else
            for (final b in balances.take(50)) _balanceTile(context, b),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _summaryCards(List<UnifiedStatementRow> rows, List<CustomerSummary> customers) {
    final localDrafts = localDraftCount(rows);
    return Column(
      children: [
        Row(
          children: [
            _stat(context, 'الكشوفات', '${rows.length}'),
            const SizedBox(width: 8),
            _stat(context, 'إجمالي الصافي', fmtMoney(totalUnifiedNet(rows))),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _stat(context, 'إجمالي المستحق على العملاء',
                fmtMoney(totalOutstanding(customers))),
            const SizedBox(width: 8),
            _stat(context, 'مسودات محلية غير مرفوعة', '$localDrafts'),
          ],
        ),
      ],
    );
  }

  Widget _stat(BuildContext context, String label, String value) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Text(value,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ],
            ),
          ),
        ),
      );

  Widget _unifiedTile(BuildContext context, UnifiedStatementRow r) {
    final stale = !r.local &&
        r.bucket == StatementBucket.drafts &&
        DateTime.now().difference(r.date).inDays >= kStaleDraftDays;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Icon(r.local ? Icons.cloud_off_outlined : Icons.receipt_long_outlined),
        ),
        title: Text(r.number.isEmpty ? 'بدون رقم' : r.number),
        subtitle: Text(
          [
            if (r.customerName.isNotEmpty) r.customerName,
            _dateLabel(r.date),
            if (r.local) 'محلي',
          ].join(' · '),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(fmtMoney(r.net), style: const TextStyle(fontWeight: FontWeight.w600)),
            _statusChip(context, r),
            if (stale) _staleChip(context),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(BuildContext context, UnifiedStatementRow r) {
    final color = _bucketColor(context, r);
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        r.statusLabel,
        style: TextStyle(fontSize: 11, color: color),
      ),
    );
  }

  Widget _staleChip(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 2),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.amber.shade100,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          'مسودة قديمة',
          style: TextStyle(fontSize: 11, color: Colors.amber.shade900),
        ),
      );

  Widget _staleBanner(int count) => Card(
        color: Colors.amber.shade50,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'تنبيه: $count كشف مسودّة مضى عليه أكثر من $kStaleDraftDays أيام — راجع الأسعار.',
                  style: TextStyle(color: Colors.amber.shade900),
                ),
              ),
            ],
          ),
        ),
      );

  Color _bucketColor(BuildContext context, UnifiedStatementRow r) {
    switch (r.bucket) {
      case StatementBucket.approved:
        return Colors.green.shade600;
      case StatementBucket.uploaded:
        return Colors.orange.shade700;
      case StatementBucket.other:
        return Theme.of(context).colorScheme.error;
      case StatementBucket.drafts:
        return r.local ? Colors.blueGrey.shade600 : Colors.grey.shade600;
    }
  }

  Widget _balanceTile(BuildContext context, BalanceRow b) => Card(
        child: ListTile(
          dense: true,
          leading: const CircleAvatar(child: Icon(Icons.person_outline)),
          title: Text(b.name),
          subtitle: Text(b.code),
          trailing: Text(
            fmtMoney(b.balance),
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: b.balance > 0 ? Theme.of(context).colorScheme.error : Colors.green.shade700,
            ),
          ),
        ),
      );

  Widget _emptyCard(String message) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(message),
        ),
      );

  String _dateLabel(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
