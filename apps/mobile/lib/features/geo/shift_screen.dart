import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/geo/location.dart';
import '../../core/geo/shift_controller.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// شاشة تتبع الموقع: بدء/إنهاء الوردية، متابعة النقاط، وتسجيل الزيارات.
class ShiftScreen extends ConsumerStatefulWidget {
  const ShiftScreen({super.key});

  @override
  ConsumerState<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends ConsumerState<ShiftScreen> {
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    // تتبّع يحدّث عدّاد مدة الوردية كل ثانية.
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    ref.read(shiftControllerProvider.notifier).syncFromServer();
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.read(shiftControllerProvider.notifier);
    final shift = ref.watch(shiftControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('تتبع المندوب')),
      body: shift.shift == null ? _idleView(context, shift, controller) : _activeView(context, shift),
    );
  }

  Widget _idleView(BuildContext context, ShiftState state, ShiftController controller) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.my_location, color: Theme.of(context).colorScheme.primary, size: 32),
                const SizedBox(height: 12),
                Text('لا توجد وردية نشطة', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text(
                  'ابدأ الوردية ليُرسل التطبيق موقعك كل دقيقة أثناء العمل، '
                  'وتُسجَّل زياراتك للعملاء مع التحقق من القرب (150م).',
                  style: TextStyle(height: 1.5),
                ),
                if (state.error != null) ...[
                  const SizedBox(height: 12),
                  Text(state.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: state.busy ? null : () => controller.startShift(),
                  icon: state.busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.play_arrow),
                  label: Text(state.busy ? 'جارِ البدء…' : 'ابدأ الوردية'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _activeView(BuildContext context, ShiftState state) {
    final shift = state.shift!;
    final elapsed = DateTime.now().difference(shift.startedAt);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: BayanTheme.uploadedColor.withValues(alpha: 0.12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.play_circle_fill, color: BayanTheme.uploadedColor, size: 28),
                    const SizedBox(width: 8),
                    Text('الوردية نشطة', style: Theme.of(context).textTheme.titleLarge),
                  ],
                ),
                const SizedBox(height: 12),
                _kv('بدأت في', _fmt(shift.startedAt)),
                _kv('المدة', _elapsed(elapsed)),
                _kv('النقاط المُرسلة', state.pushedLocations.toString()),
                if (state.lastPushAt != null) _kv('آخر إرسال', _fmt(state.lastPushAt!)),
                if (state.lastPosition != null) ...[
                  const SizedBox(height: 8),
                  _positionCard(state.lastPosition!),
                ],
                if (state.error != null) ...[
                  const SizedBox(height: 8),
                  Text(state.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
              ],
            ),
          ),
        ),
        if (state.lastVisit != null)
          Card(
            child: ListTile(
              leading: Icon(
                state.lastVisit!.isMissed ? Icons.cancel_outlined : Icons.check_circle_outline,
                color: state.lastVisit!.isMissed ? BayanTheme.rejectedColor : BayanTheme.uploadedColor,
              ),
              title: Text('آخر زيارة: ${state.lastVisit!.customerName}'),
              subtitle: Text({
                if (state.lastVisit!.isMissed) 'لم تتم الزيارة',
                if (!state.lastVisit!.isMissed) 'تمت الزيارة',
                if (state.lastVisit!.outOfRange) ' — خارج النطاق',
                if (state.lastVisit!.distanceM != null) ' (${state.lastVisit!.distanceM}م)',
              }.join()),
            ),
          ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => _pickCustomer(context),
          icon: const Icon(Icons.person_search),
          label: const Text('سجّل زيارة عميل'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: state.busy ? null : () => ref.read(shiftControllerProvider.notifier).stopShift(),
          icon: state.busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.stop),
          label: Text(state.busy ? 'جارِ الإنهاء…' : 'إنهاء الوردية'),
        ),
      ],
    );
  }

  Widget _kv(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            SizedBox(width: 120, child: Text(label, style: const TextStyle(color: Colors.black54))),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
          ],
        ),
      );

  Widget _positionCard(GeoPosition p) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('آخر موقع', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              '${p.lat.toStringAsFixed(6)}, ${p.lng.toStringAsFixed(6)}'
              '${p.accuracy == null ? '' : '  (±${p.accuracy!.toStringAsFixed(0)}م)'}',
              style: const TextStyle(fontFamily: 'monospace'),
            ),
          ],
        ),
      );

  String _fmt(DateTime t) {
    final local = t.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.hour)}:${two(local.minute)}:${two(local.second)}';
  }

  String _elapsed(Duration d) {
    String two(int n) => n.toString().padLeft(2, '0');
    final h = d.inHours, m = d.inMinutes.remainder(60), s = d.inSeconds.remainder(60);
    return '${two(h)}:${two(m)}:${two(s)}';
  }

  Future<void> _pickCustomer(BuildContext context) async {
    final customers = ref.read(dataStoreProvider).customers;
    if (customers.isEmpty) {
      _snack('لا عملاء متاحون — نزّل البيانات أولاً عبر المزامنة');
      return;
    }
    final selected = await showModalBottomSheet<CustomerSummary>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CustomerPicker(customers: customers),
    );
    if (selected == null || !context.mounted) return;

    final action = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('تسجيل زيارة — ${selected.name}'),
        content: const Text('هل تمت زيارة العميل؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'missed'),
            child: const Text('لم تتم'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, 'done'),
            child: const Text('تمت'),
          ),
        ],
      ),
    );
    if (action == null || !mounted) return;

    final result = await ref
        .read(shiftControllerProvider.notifier)
        .recordVisit(customerId: selected.id, missed: action == 'missed');
    if (!mounted) return;
    if (result == null) return;
    final msg = [
      result.isMissed ? 'سُجّلت الزيارة «لم تتم»' : 'سُجّلت الزيارة «تمت»',
      if (result.outOfRange) ' — خارج النطاق (خارج 150م)',
      if (!result.outOfRange && result.distanceM != null) ' — ضمن النطاق (${result.distanceM}م)',
    ].join();
    _snack(msg);
  }
}

class _CustomerPicker extends StatefulWidget {
  final List<CustomerSummary> customers;
  const _CustomerPicker({required this.customers});

  @override
  State<_CustomerPicker> createState() => _CustomerPickerState();
}

class _CustomerPickerState extends State<_CustomerPicker> {
  final _query = TextEditingController();
  String _filter = '';

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.customers
        .where((c) =>
            _filter.isEmpty ||
            c.name.contains(_filter) ||
            c.code.contains(_filter) ||
            (c.phone ?? '').contains(_filter))
        .toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('اختر العميل', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _query,
              decoration: const InputDecoration(hintText: 'بحث بالاسم / الكود / الهاتف', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _filter = v.trim()),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: list.length,
                itemBuilder: (ctx, i) {
                  final c = list[i];
                  return ListTile(
                    dense: true,
                    title: Text(c.name),
                    subtitle: Text(c.phone ?? c.code),
                    onTap: () => Navigator.pop(ctx, c),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}