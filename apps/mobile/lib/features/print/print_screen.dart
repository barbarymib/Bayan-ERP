import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/print/pdf_export.dart';
import '../../core/print/receipt.dart';
import '../../core/theme.dart';
import '../print/print_controller.dart';

class PrintScreen extends ConsumerStatefulWidget {
  const PrintScreen({super.key});

  @override
  ConsumerState<PrintScreen> createState() => _PrintScreenState();
}

class _PrintScreenState extends ConsumerState<PrintScreen> {
  @override
  void initState() {
    super.initState();
    // تحدّث قائمة المستندات وقراءة الميزات (لتصفية أوراق التجزئة) عند فتح الشاشة.
    Future.microtask(() {
      ref.read(printControllerProvider.notifier).refresh();
      ref.read(printControllerProvider.notifier).loadFeatures();
    });
  }

  @override
  Widget build(BuildContext context) {
    final print = ref.watch(printControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الطباعة والتصدير'),
        actions: [
          IconButton(
            tooltip: 'مشاركة PDF',
            icon: const Icon(Icons.picture_as_pdf),
            onPressed: print.doc == null || print.busy
                ? null
                : () => ref.read(printControllerProvider.notifier).sharePdf(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (print.doc == null)
            ..._documents(context, print)
          else ...[
            _documentCard(context, print),
            const SizedBox(height: 12),
            _paperPicker(print),
            const SizedBox(height: 12),
            if (print.previewPng != null) ...[
              Center(
                child: Image.memory(print.previewPng!, width: 300),
              ),
              const SizedBox(height: 12),
            ],
            _printerSection(print),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: print.connected && print.doc != null && !print.busy
                        ? () => ref.read(printControllerProvider.notifier).printCurrent()
                        : null,
                    icon: print.status == PrintStatus.printing
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.print),
                    label: const Text('طباعة'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: print.doc != null && !print.busy
                        ? () => ref.read(printControllerProvider.notifier).sharePdf()
                        : null,
                    icon: const Icon(Icons.share),
                    label: const Text('مشاركة PDF'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => ref.read(printControllerProvider.notifier).clearSelection(),
              child: const Text('اختيار مستند آخر'),
            ),
          ],
          if (print.message != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                print.message!,
                style: TextStyle(color: Theme.of(context).colorScheme.primary),
              ),
            ),
          if (print.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                print.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _documents(BuildContext context, PrintState state) {
    if (state.documents.isEmpty) {
      return const [
        Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('لا توجد مستندات للطباعة — أنشئ بياناً أو سند قبض أو مرتجعاً أولاً.'),
          ),
        ),
      ];
    }
    return [
      Text('مستندات قابلة للطباعة (${state.documents.length})',
          style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      for (final i in state.documents)
        Card(
          child: ListTile(
            dense: true,
            leading: Icon(_iconFor(i.type)),
            title: Text(i.number ?? i.clientUuid.substring(0, 8)),
            subtitle: Text(
              '${_typeLabel(i.type)} · '
              '${i.createdAt.toLocal().toString().substring(0, 16)}',
            ),
            trailing: _StatusChip(status: i.status),
            onTap: () => ref.read(printControllerProvider.notifier).select(i),
          ),
        ),
    ];
  }

  Widget _documentCard(BuildContext context, PrintState state) {
    final doc = state.doc!;
    final rows = <(String, String)>[
      ('النوع', doc.title),
      if (doc.docNumber != null) ('الرقم', doc.docNumber!),
      ('التاريخ', doc.dateLabel),
      if (doc.customerName != null && doc.customerName!.isNotEmpty)
        ('العميل', doc.customerName!),
      for (final s in doc.summary) (s.label, s.value),
      if (doc.balanceBefore != null) ('رصيد سابق', fmtMoney(doc.balanceBefore!)),
      if (doc.balanceAfter != null) ('الرصيد بعد', fmtMoney(doc.balanceAfter!)),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(doc.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final (label, value) in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label, style: Theme.of(context).textTheme.bodyMedium),
                    Text(value,
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Text('بنود: ${doc.lines.length}',
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Widget _paperPicker(PrintState state) {
    final allowed = state.allowedPapers;
    final current = allowed.contains(state.paper) ? state.paper : allowed.first;
    return DropdownButtonFormField<ReceiptPaper>(
      initialValue: current,
      decoration: const InputDecoration(labelText: 'الورق / الصيغة'),
      items: allowed.map((p) => DropdownMenuItem(value: p, child: Text(p.label))).toList(),
      onChanged: (p) {
        if (p != null) {
          ref.read(printControllerProvider.notifier).setPaper(p);
        }
      },
    );
  }

  Widget _printerSection(PrintState state) {
    final controller = ref.read(printControllerProvider.notifier);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  state.connected ? Icons.bluetooth_connected : Icons.bluetooth,
                  color: state.connected ? BayanTheme.uploadedColor : null,
                ),
                const SizedBox(width: 8),
                Text('طابعة البلوتوث',
                    style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: state.busy
                      ? null
                      : () => controller.scan(),
                  icon: state.status == PrintStatus.scanning
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.bluetooth_searching),
                  label: Text(state.status == PrintStatus.scanning
                      ? 'جارٍ البحث…'
                      : 'بحث عن طابعة'),
                ),
              ],
            ),
            if (state.connected)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: const Icon(Icons.check_circle, color: BayanTheme.uploadedColor),
                title: Text(state.printer!.display),
                trailing: TextButton(
                  onPressed: state.busy ? null : () => controller.disconnect(),
                  child: const Text('قطع الاتصال'),
                ),
              )
            else if (state.printer != null || state.printers.isNotEmpty) ...[
              for (final d in state.printers)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(Icons.print_outlined),
                  title: Text(d.display),
                  subtitle: d.address == state.lastPrinterAddress
                      ? const Text('آخر طابعة مستخدمة')
                      : null,
                  trailing: FilledButton.tonal(
                    onPressed: state.busy
                        ? null
                        : () => controller.connect(d),
                    child: const Text('اتصال'),
                  ),
                  onTap: state.busy ? null : () => controller.connect(d),
                ),
            ] else
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'لا توجد طابعات مكتشفة — اضغط «بحث عن طابعة».',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'price_statement':
        return Icons.receipt_long;
      case 'return_statement':
        return Icons.keyboard_return;
      case 'receipt':
        return Icons.payments_outlined;
      default:
        return Icons.description_outlined;
    }
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'price_statement':
        return 'بيان أسعار';
      case 'return_statement':
        return 'مرتجع';
      case 'receipt':
        return 'سند قبض';
      default:
        return type;
    }
  }
}

class _StatusChip extends StatelessWidget {
  final SyncStatus status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: BayanTheme.statusColor(status).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        BayanTheme.statusLabel(status),
        style: TextStyle(
          color: BayanTheme.statusColor(status),
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}