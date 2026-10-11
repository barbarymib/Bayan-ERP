import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme.dart';
import '../sync/sync_controller.dart';

class NewCollectionScreen extends ConsumerStatefulWidget {
  const NewCollectionScreen({super.key});

  @override
  ConsumerState<NewCollectionScreen> createState() => _NewCollectionScreenState();
}

class _NewCollectionScreenState extends ConsumerState<NewCollectionScreen> {
  int? _customerId;
  int? _statementId;
  String _method = 'CASH';
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _notes = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;

  Future<void> _save() async {
    if (_customerId == null || _amountValue <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('اختر العميل وأدخل مبلغاً صحيحاً')),
      );
      return;
    }
    setState(() => _saving = true);
    final repCode = ref.read(sessionProvider).user?.repCode ?? '';
    final number = await ref.read(numberingProvider).next('RC', repCode);
    final payload = <String, dynamic>{
      'customerId': _customerId,
      'amount': _amountValue,
      'method': _method,
      'receivedAt': DateTime.now().toIso8601String(),
      if (_statementId != null) 'statementId': _statementId,
      if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
    };
    final ok = ref.read(syncControllerProvider.notifier).enqueue(
          type: 'receipt',
          payload: payload,
          number: number,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'حُفظ سند القبض محلياً' : 'السند موجود مسبقاً'),
        backgroundColor: ok ? BayanTheme.uploadedColor : null,
      ),
    );
    if (ok) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(dataStoreProvider).customers;
    final statements = ref
        .watch(dataStoreProvider)
        .statements
        .where((s) => s.customerId == _customerId && s.status == 'APPROVED')
        .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('سند قبض جديد')),
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
            onChanged: (v) => setState(() {
              _customerId = v;
              _statementId = null;
            }),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'المبلغ'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _method,
            decoration: const InputDecoration(labelText: 'طريقة الدفع'),
            items: const [
              DropdownMenuItem(value: 'CASH', child: Text('نقداً')),
              DropdownMenuItem(value: 'CHEQUE', child: Text('شيك')),
            ],
            onChanged: (v) => setState(() => _method = v ?? 'CASH'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _statementId,
            decoration: const InputDecoration(
              labelText: 'تخصيص على بيان (اختياري)',
            ),
            items: statements
                .map((s) => DropdownMenuItem(
                      value: s.id,
                      child: Text('${s.number} — ${s.net.toStringAsFixed(2)}',
                          overflow: TextOverflow.ellipsis),
                    ))
                .toList(),
            onChanged: (v) => setState(() => _statementId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'ملاحظات'),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ السند محلياً'),
          ),
        ),
      ),
    );
  }
}