import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/geo/shift_controller.dart';
import '../../core/providers.dart';
import '../auth/auth_controller.dart';
import '../sync/sync_controller.dart';

/// شاشة «المزامنة والإعدادات» (§8.2 #8): بيانات الحساب والجهاز، فترة التتبع،
/// قفل الجهاز، آخر مزامنة، وزر الخروج.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final user = ref.watch(authControllerProvider).user ?? session.user;
    final sync = ref.watch(syncControllerProvider);
    final intervalSec = ref.watch(trackingIntervalProvider).inSeconds;
    final baseUrl = ref.watch(apiClientProvider).baseUrl;
    final deviceId = session.deviceId;
    final lastSync = sync.lastSyncAt ?? session.lastSyncAt;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('المزامنة والإعدادات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionTitle(theme, 'الحساب'),
          Card(
            child: Column(
              children: [
                _kv('الاسم', user?.name ?? '—'),
                _kv('الدور', user?.roleCode ?? '—'),
                if ((user?.repCode ?? '').isNotEmpty) _kv('كود المندوب', user!.repCode!),
                if (user?.companyId != null) _kv('الشركة', '${user!.companyId}'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _sectionTitle(theme, 'الجهاز والاتصال'),
          Card(
            child: Column(
              children: [
                _kv('معرّف الجهاز', deviceId ?? 'غير مسجّل'),
                _kv('الخادم', baseUrl),
                _kv('آخر مزامنة', lastSync == null ? 'لم تتم بعد' : _fmt(lastSync)),
                _kv('العمليات المعلّقة', '${sync.pending}'),
                if (sync.failed > 0) _kv('عمليات فاشلة', '${sync.failed}'),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: FilledButton.tonalIcon(
              onPressed: sync.running ? null : () => ref.read(syncControllerProvider.notifier).syncNow(),
              icon: const Icon(Icons.sync),
              label: Text(sync.running ? 'جارٍ المزامنة…' : 'مزامنة الآن'),
            ),
          ),
          const SizedBox(height: 16),
          _sectionTitle(theme, 'التتبع الجغرافي'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'فترة إرسال الموقع: $intervalSec ثانية',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Slider(
                    value: intervalSec.toDouble(),
                    min: 30,
                    max: 120,
                    divisions: 9,
                    label: '$intervalSec ثانية',
                    onChanged: (v) => ref
                        .read(shiftControllerProvider.notifier)
                        .setInterval(Duration(seconds: v.round())),
                  ),
                  const Text(
                    'تزداد الفترة تلقائياً عند الثبات لتوفير البطارية.',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _sectionTitle(theme, 'الأمان'),
          Card(
            child: SwitchListTile(
              value: session.deviceLockEnabled,
              onChanged: (v) async {
                await session.saveDeviceLockEnabled(v);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(v ? 'تم تفعيل قفل الجهاز' : 'تم إلغاء قفل الجهاز')),
                );
              },
              secondary: const Icon(Icons.lock_outline),
              title: const Text('قفل الجهاز (بصمة/PIN)'),
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('تسجيل الخروج'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _sectionTitle(ThemeData theme, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: theme.textTheme.titleMedium),
      );

  Widget _kv(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Text(label, style: const TextStyle(fontSize: 13, color: Colors.black54)),
            const Spacer(),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')} '
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
