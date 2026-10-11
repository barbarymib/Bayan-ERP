import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/calc/calc.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../sync/sync_controller.dart';

/// أسباب المرتجع المعتمدة على الخادم (مطابقة لبذور الخادم).
const _returnReasons = <String, String>{
  'DEFECT': 'عيب صناعة',
  'WRONG_ORDER': 'خطأ في الطلب',
  'DAMAGED': 'تلف',
  'OTHER': 'أخرى',
};

class _ReturnLine {
  final StatementLineSummary line;
  final TextEditingController qty = TextEditingController();
  String condition = 'GOOD';

  _ReturnLine({required this.line});

  void dispose() => qty.dispose();

  double get qtyValue => double.tryParse(qty.text.trim()) ?? 0;

  double get value {
    final q = qtyValue;
    if (q <= 0 || q > line.qty) return 0;
    return calcReturnLineValue(line.netLine, line.qty, q);
  }
}

class NewReturnScreen extends ConsumerStatefulWidget {
  const NewReturnScreen({super.key});

  @override
  ConsumerState<NewReturnScreen> createState() => _NewReturnScreenState();
}

class _NewReturnScreenState extends ConsumerState<NewReturnScreen> {
  int? _customerId;
  int? _statementId;
  String _reason = 'DEFECT';
  final List<_ReturnLine> _lines = [];
  bool _saving = false;

  @override
  void dispose() {
    for (final l in _lines) {
      l.dispose();
    }
    super.dispose();
  }

  List<StatementSummary> get _statements => ref
      .read(dataStoreProvider)
      .statements
      .where((s) => s.customerId == _customerId && s.status == 'APPROVED')
      .toList();

  StatementSummary? get _selected {
    for (final s in _statements) {
      if (s.id == _statementId) return s;
    }
    return null;
  }

  void _selectStatement(StatementSummary? st) {
    setState(() {
      _statementId = st?.id;
      for (final l in _lines) {
        l.dispose();
      }
      _lines.clear();
      if (st != null) {
        for (final line in st.lines) {
          _lines.add(_ReturnLine(line: line));
        }
      }
    });
  }

  Future<void> _save() async {
    if (_customerId == null || _statementId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('اختر العميل والبيان المراد الإرجاع منه')),
      );
      return;
    }
    final lines = <Map<String, dynamic>>[];
    for (final l in _lines) {
      final q = l.qtyValue;
      if (q <= 0) continue;
      lines.add({
        'sourceLineId': l.line.id,
        'qty': q,
        'condition': l.condition,
      });
    }
    if (lines.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('أدخل كمية لبند واحد على الأقل')));
      return;
    }
    setState(() => _saving = true);
    final repCode = ref.read(sessionProvider).user?.repCode ?? '';
    final number = await ref.read(numberingProvider).next('RT', repCode);
    final payload = <String, dynamic>{
      'mode': 'BY_REP',
      'customerId': _customerId,
      'reasonCode': _reason,
      'date': DateTime.now().toIso8601String(),
      'lines': lines,
    };
    final ok = ref.read(syncControllerProvider.notifier).enqueue(
          type: 'return_statement',
          payload: payload,
          number: number,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'حُفظ المرتجع محلياً' : 'المرتجع موجود مسبقاً'),
        backgroundColor: ok ? BayanTheme.uploadedColor : null,
      ),
    );
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(dataStoreProvider).customers;
    final statements = _statements;
    final total = _lines.fold<double>(0, (s, l) => s + l.value);

    return Scaffold(
      appBar: AppBar(title: const Text('مرتجع جديد')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<int>(
            initialValue: _customerId,
            decoration: const InputDecoration(labelText: 'العميل'),
            items: customers
                .map((c) => DropdownMenuItem(
                      value: c.id,
                      child: Text(c.name, overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: (v) {
              _customerId = v;
              _selectStatement(null);
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _statementId,
            decoration: const InputDecoration(labelText: 'البيان (المعتمد)'),
            items: statements
                .map((s) => DropdownMenuItem(
                      value: s.id,
                      child: Text('${s.number} — ${s.net.toStringAsFixed(2)}',
                          overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: (v) {
              StatementSummary? st;
              for (final s in statements) {
                if (s.id == v) st = s;
              }
              _selectStatement(st);
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(labelText: 'سبب الإرجاع'),
            items: _returnReasons.entries
                .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: (v) => setState(() => _reason = v ?? 'DEFECT'),
          ),
          const SizedBox(height: 16),
          if (_selected == null)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('اختر البيان لعرض بنوده. اعتمد المكتب البيان أولاً.'),
              ),
            ),
          for (var i = 0; i < _lines.length; i++) _lineCard(_lines[i], i),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Text('إجمالي المرتجع'),
                  const Spacer(),
                  Text(total.toStringAsFixed(2),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
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
            child: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ المرتجع محلياً'),
          ),
        ),
      ),
    );
  }

  Widget _lineCard(_ReturnLine l, int index) {
    final original = l.line.qty;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('بند ${l.line.itemId} · أصلي: $original')),
                Text(l.value.toStringAsFixed(2)),
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
                  child: DropdownButtonFormField<String>(
                    initialValue: l.condition,
                    decoration: const InputDecoration(labelText: 'الحالة'),
                    items: const [
                      DropdownMenuItem(value: 'GOOD', child: Text('سليم')),
                      DropdownMenuItem(value: 'DAMAGED', child: Text('تالف')),
                    ],
                    onChanged: (v) => setState(() => l.condition = v ?? 'GOOD'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}