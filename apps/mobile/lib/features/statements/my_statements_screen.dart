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
  String? _status;

  static const _statuses = <String?>[null, 'APPROVED', 'PENDING_REVIEW'];

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(dataStoreProvider);
    final statements = filterStatements(
      store.statements,
      store.customers,
      status: _status,
      query: _query,
    );
    final balances = balancesSorted(store.customers);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('بياناتي')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _summaryCards(store.statements, store.customers),
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
              for (final s in _statuses)
                ChoiceChip(
                  label: Text(s == null ? 'الكل' : statementStatusLabel(s)),
                  selected: _status == s,
                  onSelected: (_) => setState(() => _status = s),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text('الكشوفات (${statements.length})',
              style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          if (store.statements.isEmpty)
            _emptyCard('لا توجد كشوفات. نزّل البيانات ثم أعد المحاولة.')
          else if (statements.isEmpty)
            _emptyCard('لا توجد نتائج مطابقة.')
          else
            for (final s in statements) _statementTile(context, s, store.customers),
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

  Widget _summaryCards(List<StatementSummary> statements, List<CustomerSummary> customers) {
    return Column(
      children: [
        Row(
          children: [
            _stat(context, 'الكشوفات', '${statements.length}'),
            const SizedBox(width: 8),
            _stat(context, 'إجمالي الصافي', fmtMoney(totalNet(statements))),
          ],
        ),
        const SizedBox(height: 8),
        _stat(context, 'إجمالي المستحق على العملاء', fmtMoney(totalOutstanding(customers))),
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

  Widget _statementTile(
    BuildContext context,
    StatementSummary s,
    List<CustomerSummary> customers,
  ) {
    final name = customerNameById(customers, s.customerId);
    return Card(
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.receipt_long_outlined)),
        title: Text(s.number),
        subtitle: Text(
          [
            if (name.isNotEmpty) name,
            _dateLabel(s.date),
            '${s.lines.length} بند',
          ].join(' · '),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(fmtMoney(s.net), style: const TextStyle(fontWeight: FontWeight.w600)),
            _statusChip(context, s.status),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(BuildContext context, String status) => Container(
        margin: const EdgeInsets.only(top: 2),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: _statusColor(context, status).withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          statementStatusLabel(status),
          style: TextStyle(fontSize: 11, color: _statusColor(context, status)),
        ),
      );

  Color _statusColor(BuildContext context, String status) {
    switch (status) {
      case 'APPROVED':
        return Colors.green.shade600;
      case 'PENDING_REVIEW':
        return Colors.orange.shade700;
      case 'CANCELLED':
        return Theme.of(context).colorScheme.error;
      default:
        return Colors.grey.shade600;
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
