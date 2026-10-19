import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/calc/calc.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/scan_resolver.dart';
import '../../core/theme.dart';
import '../sync/sync_controller.dart';
import '../tools/scan_screen.dart';

class _Line {
  final int itemId;
  final String name;
  final bool isSteel;
  final TextEditingController qty = TextEditingController();
  final TextEditingController price = TextEditingController();
  final DiscountType discountType = DiscountType.percent;
  final TextEditingController discountValue = TextEditingController();
  final TextEditingController weightNote = TextEditingController();

  /// الوحدة المختارة (§5.12/G14) + وحدات البيع المتاحة للتبديل بينها.
  String? unitCode;
  final List<ItemUnitSummary> units;

  _Line({
    required this.itemId,
    required this.name,
    this.isSteel = false,
    this.unitCode,
    this.units = const [],
    String? qtyText,
    String? priceText,
  }) {
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

  /// عامل التحويل بلا كسور زائدة: 1000 → «1000»، 12.482 → «12.482».
  static String _fmtFactor(double f) =>
      f == f.roundToDouble() ? f.round().toString() : f.toString();

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

  /// يضيف سطراً جديداً ويُعيد السطر (§5.12/G14). الوحدة: وحدة الفحص إن كانت
  /// بيعية، وإلا الأساسية؛ والسعر: سعر الوحدة المختارة من قائمة أسعار العميل إن
  /// وُجد، ثم سعر القائمة العام، ثم آخر سعر للصنف.
  _Line _addItem(ItemSummary it, {String? scannedUnitCode}) {
    final store = ref.read(dataStoreProvider);
    final units = saleUnits(it);
    final selected = selectLineUnit(units, scannedCode: scannedUnitCode);
    double? price;
    if (_customerId != null) {
      for (final u in units) {
        if (u.unitCode == selected && u.unitId > 0) {
          price = store.priceForCustomer(_customerId!, it.id, unitId: u.unitId);
          if (price != null) break;
        }
      }
      price ??= store.priceForCustomer(_customerId!, it.id);
    }
    price ??= it.lastPrice ?? 0;
    final line = _Line(
      itemId: it.id,
      name: it.name,
      isSteel: it.isSteel,
      unitCode: selected,
      units: units,
      priceText: price.toStringAsFixed(2),
    );
    setState(() => _lines.add(line));
    return line;
  }

  /// فحص باركود (صنف/وحدة) وإضافة سطر مباشرة (§9/G13 + §5.12/G14).
  Future<void> _scanLine() async {
    final store = ref.read(dataStoreProvider);
    if (store.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لا توجد أصناف بعد — نزّل المزامنة أولاً')),
      );
      return;
    }
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute<String>(builder: (_) => const ScanScreen(title: 'فحص صنف للبيان')),
    );
    if (!mounted || code == null) return;
    final target = resolveScan(code, store.items);
    if (target == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لا يوجد صنف مطابق للباركود «$code»')),
      );
      return;
    }
    final scannedUnit = target.unit;
    final line = _addItem(target.item, scannedUnitCode: scannedUnit?.unitCode);
    final unit = line.unitCode;
    final note = scannedUnit == null
        ? ''
        : unit == scannedUnit.unitCode
            ? ' — وحدة $unit'
            : ' — الوحدة ${scannedUnit.unitCode} غير مُصرَّح بها للبيع فبقيت ${unit ?? 'الأساسية'}';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('أُضيف ${target.item.name}$note')),
    );
  }

  /// تبديل وحدة السطر (§5.12/G14): يعيد التسعير إن وُجد سعر دقيق للوحدة.
  void _changeUnit(_Line l, String? code) {
    if (code == null || code == l.unitCode) return;
    setState(() {
      l.unitCode = code;
      if (_customerId == null) return;
      final store = ref.read(dataStoreProvider);
      for (final u in l.units) {
        if (u.unitCode == code && u.unitId > 0) {
          final p = store.priceForCustomer(_customerId!, l.itemId, unitId: u.unitId);
          if (p != null) l.price.text = p.toStringAsFixed(2);
          return;
        }
      }
    });
  }

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
                _addItem(it);
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
            if (e.value.unitCode != null) 'unitCode': e.value.unitCode,
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
      appBar: AppBar(
        title: const Text('بيان أسعار جديد'),
        actions: [
          IconButton(
            tooltip: 'فحص باركود',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: _scanLine,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<int>(
            initialValue: _customerId,
            key: ValueKey<int?>(_customerId),
            decoration: InputDecoration(
              labelText: 'العميل',
              suffixIcon: IconButton(
                tooltip: 'فحص QR الزبون',
                icon: const Icon(Icons.qr_code_scanner),
                onPressed: () async {
                  final customer = await scanCustomer(context, customers);
                  if (customer == null || !mounted) return;
                  setState(() => _customerId = customer.id);
                },
              ),
            ),
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
          if (_num(_headerDiscount) > 0 && totals.subtotal > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'القيمة المكافئة ≈ '
                '${calcLineDiscount(totals.subtotal, Discount(DiscountType.percent, _num(_headerDiscount))).toStringAsFixed(2)} ج',
                style: Theme.of(context).textTheme.bodySmall,
              ),
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
            if (l.units.length > 1) ...[
              DropdownButtonFormField<String>(
                initialValue: l.unitCode,
                key: ValueKey<String?>('${l.itemId}:${l.unitCode}'),
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'وحدة القياس', isDense: true),
                items: [
                  for (final u in l.units)
                    DropdownMenuItem(
                      value: u.unitCode,
                      child: Text('${u.unitCode ?? ''} ×${_fmtFactor(u.factorToBase)}'),
                    ),
                ],
                onChanged: (v) => _changeUnit(l, v),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: l.qty,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      labelText: 'الكمية',
                      suffixText: l.unitCode,
                    ),
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
            if (_num(l.discountValue) > 0 && _num(l.qty) * _num(l.price) > 0)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'القيمة المكافئة ≈ '
                  '${calcLineDiscount(_num(l.qty) * _num(l.price), Discount(DiscountType.percent, _num(l.discountValue))).toStringAsFixed(2)} ج',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
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