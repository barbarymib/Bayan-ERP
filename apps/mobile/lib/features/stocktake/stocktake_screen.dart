import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/scan_resolver.dart';
import '../../core/theme.dart';
import '../tools/scan_screen.dart';
import 'stocktake_controller.dart';

/// قائمة جلسات الجرد لمندوب المخزن (§5.8 خطوة 3): يختار جلسة مفتوحة/قيد العد
/// ثم يُدخل الكميات الفعلية يدوياً — أونلاين أو أوفلاين عبر صندوق الصادر.
class StocktakeScreen extends ConsumerStatefulWidget {
  const StocktakeScreen({super.key});

  @override
  ConsumerState<StocktakeScreen> createState() => _StocktakeScreenState();
}

class _StocktakeScreenState extends ConsumerState<StocktakeScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(stocktakeListProvider.notifier).load());
  }

  void _openSession(StocktakeSession s) {
    if (!s.isCountable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('هذه الجلسة ليست قيد العدّ (للمراجعة أو الاعتماد)')),
      );
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => StocktakeCountScreen(sessionId: s.id, title: s.number),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stocktakeListProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('جرد المخزون')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(stocktakeListProvider.notifier).load(),
        child: state.loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (state.offline)
                    Card(
                      color: theme.colorScheme.tertiaryContainer,
                      child: const ListTile(
                        leading: Icon(Icons.cloud_off_outlined),
                        title: Text('عرض من الذاكرة المؤقتة (أوفلاين)'),
                        subtitle: Text('تُعرض آخر جلسات معروفة. أدخل العدّات وسيُرفعها التطبيق عند عودة الاتصال.'),
                      ),
                    ),
                  if (state.error != null && !state.offline) ...[
                    const SizedBox(height: 8),
                    Card(
                      color: theme.colorScheme.errorContainer,
                      child: ListTile(
                        leading: Icon(Icons.error_outline,
                            color: theme.colorScheme.onErrorContainer),
                        title: Text(state.error!,
                            style: TextStyle(color: theme.colorScheme.onErrorContainer)),
                        trailing: TextButton(
                          onPressed: () =>
                              ref.read(stocktakeListProvider.notifier).load(),
                          child: const Text('إعادة'),
                        ),
                      ),
                    ),
                  ],
                  if (state.sessions.isEmpty && !state.loading)
                    const Padding(
                      padding: EdgeInsets.only(top: 48),
                      child: Center(child: Text('لا توجد جلسات جرد')),
                    ),
                  for (final s in state.sessions)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          s.isCountable
                              ? Icons.fact_check_outlined
                              : Icons.lock_clock_outlined,
                        ),
                        title: Text(s.number.isEmpty ? 'جلسة #${s.id}' : s.number),
                        subtitle: Text(
                          '${s.warehouseName.isEmpty ? 'مخزن' : s.warehouseName} • ${s.lineCount} بند',
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _StatusChip(status: s.status),
                            if (s.openedAt != null)
                              Text(
                                _date(s.openedAt!),
                                style: theme.textTheme.bodySmall,
                              ),
                          ],
                        ),
                        onTap: () => _openSession(s),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

/// إدخال الكميات الفعلية لجلسة جرد — بحث بالصنف، إدخال يدوي، ثم حفظ في الصندوق.
class StocktakeCountScreen extends ConsumerStatefulWidget {
  const StocktakeCountScreen({super.key, required this.sessionId, this.title});

  final int sessionId;
  final String? title;

  @override
  ConsumerState<StocktakeCountScreen> createState() => _StocktakeCountScreenState();
}

class _StocktakeCountScreenState extends ConsumerState<StocktakeCountScreen> {
  final Map<String, TextEditingController> _ctrls = {};
  final TextEditingController _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(stocktakeCountProvider.notifier).open(widget.sessionId),
    );
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    _search.dispose();
    super.dispose();
  }

  TextEditingController _controllerFor(StocktakeLine l) {
    return _ctrls.putIfAbsent(l.key, () {
      final entered = ref.read(stocktakeCountProvider).entered[l.key];
      final initial = entered ?? l.countedQty;
      return TextEditingController(
        text: initial == null ? '' : _fmt(initial),
      );
    });
  }

  /// فحص باركود صنف ثم حصر قائمة البنود على كوده (§9/G13).
  Future<void> _scan() async {
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute<String>(builder: (_) => const ScanScreen(title: 'فحص صنف للجرد')),
    );
    if (!mounted || code == null) return;
    final target = resolveScan(code, ref.read(dataStoreProvider).items);
    if (target == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لا يوجد صنف مطابق للباركود «$code»')),
      );
      return;
    }
    _search.text = target.item.code;
    setState(() {});
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final saved = await ref.read(stocktakeCountProvider.notifier).save();
    if (!mounted) return;
    if (saved == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(stocktakeCountProvider).error ?? 'لم يُحفظ شيء')),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('حُفظت عدّات $saved بند — ستُرفع عبر المزامنة'),
        backgroundColor: BayanTheme.uploadedColor,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(stocktakeCountProvider);
    final theme = Theme.of(context);
    final query = _search.text.trim().toLowerCase();
    final visible = query.isEmpty
        ? state.lines
        : state.lines
            .where((l) =>
                l.code.toLowerCase().contains(query) ||
                l.name.toLowerCase().contains(query))
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title == null || widget.title!.isEmpty
            ? 'عدّ جلسة #${widget.sessionId}'
            : widget.title!),
      ),
      body: state.loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _header(state, theme),
                if (state.offline)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: Text('وضع أوفلاين — ستُرفع العدّات عند عودة الاتصال'),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: TextField(
                    controller: _search,
                    decoration: InputDecoration(
                      hintText: 'بحث بالكود أو الاسم…',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        tooltip: 'فحص باركود',
                        icon: const Icon(Icons.qr_code_scanner),
                        onPressed: _scan,
                      ),
                      isDense: true,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                if (state.error != null && !state.offline)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Card(
                      color: theme.colorScheme.errorContainer,
                      child: ListTile(
                        title: Text(state.error!,
                            style:
                                TextStyle(color: theme.colorScheme.onErrorContainer)),
                      ),
                    ),
                  ),
                Expanded(
                  child: visible.isEmpty
                      ? const Center(child: Text('لا بنود مطابقة'))
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: visible.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, i) => _lineTile(visible[i], theme),
                        ),
                ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: state.saving || !state.editable ? null : _save,
            icon: state.saving
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(state.saving ? 'جارٍ الحفظ…' : 'حفظ العدّات'),
          ),
        ),
      ),
    );
  }

  Widget _header(StocktakeCountState state, ThemeData theme) {
    final total = state.lines.length;
    final done = state.countedCount;
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    state.warehouseName.isEmpty ? 'مخزن' : state.warehouseName,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                _StatusChip(status: state.status),
              ],
            ),
            const SizedBox(height: 8),
            Text('العدّ: $done من $total بند',
                style: theme.textTheme.bodyMedium),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: total == 0 ? 0 : done / total,
            ),
            if (!state.editable)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('الجلسة غير قابلة للتعديل في حالتها الحالية'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _lineTile(StocktakeLine l, ThemeData theme) {
    final entered = ref.watch(stocktakeCountProvider).entered[l.key];
    final counted = entered ?? l.countedQty;
    final diff = counted == null ? null : counted - l.systemQty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.code.isEmpty ? 'صنف #${l.itemId}' : l.code,
                    style: theme.textTheme.titleSmall),
                Text(l.name, style: theme.textTheme.bodySmall),
                Text(
                  'رصيد النظام: ${_fmt(l.systemQty)}'
                  '${l.batchId.isEmpty ? '' : ' • دفعة ${l.batchId}'}'
                  '${diff == null ? '' : ' • الفرق: ${diff > 0 ? '+' : ''}${_fmt(diff)}'}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: diff != null && diff != 0
                        ? theme.colorScheme.error
                        : null,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 96,
            child: TextField(
              controller: _controllerFor(l),
              enabled: ref.watch(stocktakeCountProvider).editable,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textDirection: TextDirection.ltr,
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                labelText: 'العدّ',
                hintText: '0',
                isDense: true,
              ),
              onChanged: (v) {
                final parsed = double.tryParse(v.trim());
                ref.read(stocktakeCountProvider.notifier).setCount(
                      l.key,
                      parsed ?? -1,
                    );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  static const _labels = {
    'OPEN': 'مفتوحة',
    'COUNTING': 'قيد العد',
    'REVIEW': 'مراجعة',
    'APPROVED': 'معتمدة',
    'CLOSED': 'مغلقة',
    'ABORTED': 'ملغاة',
  };

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'OPEN' || 'COUNTING' => BayanTheme.uploadedColor,
      'REVIEW' => Colors.orange,
      _ => Theme.of(context).colorScheme.outline,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _labels[status] ?? status,
        style: TextStyle(color: color, fontSize: 12),
      ),
    );
  }
}

String _fmt(double v) {
  final s = v.toStringAsFixed(2);
  return s.endsWith('.00') ? s.substring(0, s.length - 3) : s;
}

String _date(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
