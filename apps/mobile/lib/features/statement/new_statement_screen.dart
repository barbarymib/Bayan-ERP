import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/calc/calc.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../sync/sync_controller.dart';

class _Line {
  final int itemId;
  final String name;
  final bool isSteel;
  final TextEditingController qty = TextEditingController();
  final TextEditingController price = TextEditingController();
  final DiscountType discountType = DiscountType.percent;
  final TextEditingController discountValue = TextEditingController();
  final TextEditingController weightNote = TextEditingController();

  _Line({required this.itemId, required this.name, this.isSteel = false, String? qtyText, String? priceText}) {
    qty.text = qtyText ?? '';
    price.text = priceText ?? '';
  }

  void dispose() {
    qty.dispose();
    price.dispose();
    discountValue.dispose();
    weightNote.dispose();
  }
}

class NewStatementScreen extends ConsumerStatefulWidget {
  const NewStatementScreen({super.key});

  @override
  ConsumerState<NewStatementScreen> createState() => _NewStatementScreenState();
}

class _NewStatementScreenState extends ConsumerState<NewStatementScreen> {
  final List<_Line> _lines = [];
  int? _customerId;
  final TextEditingController _headerDiscount = TextEditingController();
  final TextEditingController _paid = TextEditingController();
  String _paymentTerm = 'CREDIT';
  bool _saving = false;

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    _headerDiscount.dispose();
    _paid.dispose();
    super.dispose();
  }

  double _num(TextEditingController c) => double.tryParse(c.text.trim()) ?? 0;

  List<StatementLineInput> get _inputs => _lines
      .map((l) => StatementLineInput(
            qty: _num(l.qty),
            unitPrice: _num(l.price),
            discount: Discount(l.discountType, _num(l.discountValue)),
          ))
      .toList();

  StatementTotalsInput get _totalsInput => StatementTotalsInput(
        lines: _inputs,
        headerDiscount: Discount(
          DiscountType.percent,
          _num(_headerDiscount),
        ),
      );

  void _addLine() {
    final store = ref.read(dataStoreProvider);
    final items = store.items;
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لا توجد أصناف بعد — نزّل المزامنة أولاً')),
      );
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      builder: (_) => ListView(
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('اختر صنفاً', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
          for (final it in items)
            ListTile(
              title: Text(it.name),
              subtitle: Text(it.baseUnit ?? ''),
              onTap: () {
                Navigator.pop(context);
                final listPrice = _customerId == null
                    ? null
                    : store.priceForCustomer(_customerId!, it.id);
                final price = listPrice ?? it.lastPrice ?? 0;
                setState(() => _lines.add(
                      _Line(
                        itemId: it.id,
                        name: it.name,
                        isSteel: it.isSteel,
                        priceText: price.toStringAsFixed(2),
                      ),
                    ));
              },
            ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (_customerId == null || _lines.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('اختر العميل وأضف بنداً واحداً')));
      return;
    }
    setState(() => _saving = true);
    final geo = ref.read(locationProvider).getCurrentPosition();
    final customer = ref
        .read(dataStoreProvider)
        .customers
        .firstWhere((c) => c.id == _customerId, orElse: () => throw StateError('customer missing'));
    final totals = calcStatementTotals(_totalsInput);
    final payload = {
      'customerId': customer.id,
      'customerName': customer.name,
      'headerDiscount': _num(_headerDiscount),
      'paymentTerm': _paymentTerm,
      'paid': _num(_paid),
      'subtotal': totals.subtotal,
      'headerDiscountAmount': totals.headerDiscountAmount,
      'net': totals.net,
      'lines': _lines.asMap().entries.map((e) {
        final t = totals.lines[e.key];
        final note = e.value.isSteel ? e.value.weightNote.text.trim() : '';
        return {
          'itemId': e.value.itemId,
          'name': e.value.name,
          'qty': _num(e.value.qty),
          'unitPrice': _num(e.value.price),
          'discountType': e.value.discountType.name,
          'discountValue': _num(e.value.discountValue),
          'netFinal': t.netFinal,
          if (note.isNotEmpty) 'weightNote': note,
        };
      }).toList(),
      'createdAt': DateTime.now().toIso8601String(),
    };
    // Best-effort issuance location; statement still saves if GPS is unavailable.
    try {
      final pos = await geo;
      if (pos != null) {
        payload['lat'] = pos.lat;
        payload['lng'] = pos.lng;
      }
    } catch (_) {
      // Location unavailable or permission denied — send without coordinates.
    }
    final ok = await _enqueueStatement(payload);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'حُفظ محلياً — بانتظار الرفع' : 'البيان موجود مسبقاً'),
        backgroundColor: ok ? BayanTheme.uploadedColor : null,
      ),
    );
    if (ok) Navigator.pop(context);
  }

  Future<bool> _enqueueStatement(Map<String, dynamic> payload) async {
    final repCode = ref.read(sessionProvider).user?.repCode ?? '';
    final number = await ref.read(numberingProvider).next('BP', repCode);
    if (number != null) payload['number'] = number;
    return ref.read(syncControllerProvider.notifier).enqueue(
          type: 'price_statement',
          payload: payload,
          number: number,
        );
  }

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(dataStoreProvider).customers;
    StatementTotals totals;
    try {
      totals = calcStatementTotals(_totalsInput);
    } catch (e) {
      totals = calcStatementTotals(const StatementTotalsInput(lines: []));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('بيان أسعار جديد')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<int>(
            initialValue: _customerId,
            decoration: const InputDecoration(labelText: 'العميل'),
            items: customers
                .map((c) => DropdownMenuItem(
                      value: c.id,
                      child: Text(
                        '${c.name} — ${c.balance.toStringAsFixed(2)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ))
                .toList(),
            onChanged: (v) => setState(() => _customerId = v),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _paymentTerm,
            decoration: const InputDecoration(labelText: 'نوع السداد'),
            items: const [
              DropdownMenuItem(value: 'CASH', child: Text('نقدي')),
              DropdownMenuItem(value: 'CREDIT', child: Text('آجل')),
              DropdownMenuItem(value: 'MIXED', child: Text('مختلط')),
            ],
            onChanged: (v) => setState(() => _paymentTerm = v ?? 'CREDIT'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _paid,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'المدفوع نقداً وقت الإصدار'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text('البنود', style: Theme.of(context).textTheme.titleMedium),
              const Spacer(),
              FilledButton.tonal(onPressed: _addLine, child: const Text('+ بند')),
            ],
          ),
          const SizedBox(height: 8),
          for (var i = 0; i < _lines.length; i++) _lineCard(_lines[i], i),
          const SizedBox(height: 16),
          TextField(
            controller: _headerDiscount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'خصم البيان %'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row('الإجمالي', totals.subtotal),
                  _row('خصم البيان', totals.headerDiscountAmount),
                  const Divider(),
                  _row('الصافي', totals.net, emphasize: true),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ محلياً'),
          ),
        ),
      ),
    );
  }

  Widget _row(String label, double value, {bool emphasize = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text(label),
            const Spacer(),
            Text(
              value.toStringAsFixed(2),
              style: TextStyle(
                fontWeight: emphasize ? FontWeight.bold : FontWeight.normal,
                fontSize: emphasize ? 18 : 14,
              ),
            ),
          ],
        ),
      );

  Widget _lineCard(_Line l, int index) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(l.name)),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() {
                    l.dispose();
                    _lines.removeAt(index);
                  }),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: l.qty,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'الكمية'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: l.price,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'السعر'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: l.discountValue,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'خصم %'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            if (l.isSteel) ...[
              const SizedBox(height: 8),
              TextField(
                controller: l.weightNote,
                decoration: const InputDecoration(
                  labelText: 'ملاحظة الوزن الفعلي (الحديد)',
                  hintText: 'مثال: النظري 1000كج — الفعلي 985كج',
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ],
        ),
      ),
    );
  }
}