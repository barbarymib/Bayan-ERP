import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme.dart';
import 'handover_controller.dart';

/// شاشة تسليم العهدة النقدية: يسلّم المندوب ما حصّله من نقد للخزينة (§5.10).
class HandoverScreen extends ConsumerStatefulWidget {
  const HandoverScreen({super.key});

  @override
  ConsumerState<HandoverScreen> createState() => _HandoverScreenState();
}

class _HandoverScreenState extends ConsumerState<HandoverScreen> {
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _notes = TextEditingController();
  DateTime _date = DateTime.now();

  @override
  void initState() {
    super.initState();
    // نُسبق المبلغ بإجمالي القبض النقدي لليوم من صندوق الصادر (اقتراح قابل للتعديل).
    final suggested = todayCashCollected(ref.read(outboxProvider).all, DateTime.now());
    if (suggested > 0) _amount.text = suggested.toStringAsFixed(2);
    ref.read(handoverControllerProvider.notifier).reset();
  }

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final handover = await ref.read(handoverControllerProvider.notifier).submit(
          amount: _amountValue,
          date: _date,
          notes: _notes.text,
        );
    if (handover == null || !mounted) return;
    FocusScope.of(context).unfocus();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'سُجّل تسليم العهدة ${handover.number} بمبلغ ${handover.amount.toStringAsFixed(2)}',
        ),
        backgroundColor: BayanTheme.uploadedColor,
      ),
    );
    setState(() {
      _amount.clear();
      _notes.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(handoverControllerProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('تسليم عهدة نقدية')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Card(
            child: ListTile(
              leading: Icon(Icons.account_balance_wallet_outlined),
              title: Text('تسليم النقدية المحصّلة'),
              subtitle: Text('يُسجَّل محضر تسليم عهدة باسمك لدى الخزينة.'),
            ),
          ),
          if (state.error != null) ...[
            const SizedBox(height: 8),
            Card(
              color: theme.colorScheme.errorContainer,
              child: ListTile(
                leading:
                    Icon(Icons.error_outline, color: theme.colorScheme.onErrorContainer),
                title: Text(state.error!,
                    style: TextStyle(color: theme.colorScheme.onErrorContainer)),
              ),
            ),
          ],
          if (state.result != null) ...[
            const SizedBox(height: 8),
            Card(
              color: BayanTheme.uploadedColor.withValues(alpha: 0.12),
              child: ListTile(
                leading: Icon(Icons.check_circle_outline, color: BayanTheme.uploadedColor),
                title: Text('تم التسليم — ${state.result!.number}'),
                subtitle: Text('المبلغ: ${state.result!.amount.toStringAsFixed(2)}'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(
              labelText: 'المبلغ',
              hintText: '0.00',
              prefixIcon: Icon(Icons.payments_outlined),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _pickDate,
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'التاريخ',
                prefixIcon: Icon(Icons.event_outlined),
              ),
              child: Text(_formatDate(_date)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'ملاحظات (اختياري)',
              prefixIcon: Icon(Icons.sticky_note_2_outlined),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: state.submitting || _amountValue <= 0 ? null : _submit,
            icon: state.submitting
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.assignment_turned_in_outlined),
            label: Text(state.submitting ? 'جارٍ التسليم…' : 'تسليم العهدة'),
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
