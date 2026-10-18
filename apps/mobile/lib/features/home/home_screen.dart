import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../auth/auth_controller.dart';
import '../catalog/catalog_screen.dart';
import '../collection/new_collection_screen.dart';
import '../../core/geo/shift_controller.dart';
import '../geo/shift_screen.dart';
import '../print/print_screen.dart';
import '../return/new_return_screen.dart';
import '../statement/new_statement_screen.dart';
import '../stocktake/stocktake_screen.dart';
import '../statements/my_statements_screen.dart';
import '../sync/sync_controller.dart';
import '../tools/tools_screen.dart';
import '../treasury/handover_screen.dart';
import '../visits/visit_plan_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // إن تُركت وردية تتبع نشطة على الخادم تُستأنف تلقائياً عند فتح التطبيق.
    ref.read(shiftControllerProvider.notifier).syncFromServer();
  }

  Future<void> _toggleDeviceLock() async {
    final session = ref.read(sessionProvider);
    final next = !session.deviceLockEnabled;
    await session.saveDeviceLockEnabled(next);
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(next ? 'تم تفعيل قفل الجهاز' : 'تم إلغاء قفل الجهاز')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final sync = ref.watch(syncControllerProvider);
    final store = ref.watch(dataStoreProvider);
    final outbox = ref.read(outboxProvider);
    final tracking = ref.watch(shiftControllerProvider).isTracking;
    final user = auth.user;
    final customers = store.customers;
    final lockEnabled = ref.watch(sessionProvider).deviceLockEnabled;

    return Scaffold(
      appBar: AppBar(
        title: const Text('بيان'),
        actions: [
          IconButton(
            tooltip: 'خطة الزيارات',
            icon: const Icon(Icons.event_note_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const VisitPlanScreen()),
            ),
          ),
          IconButton(
            tooltip: 'تتبع الموقع',
            icon: Icon(
              tracking ? Icons.gps_fixed : Icons.my_location,
              color: tracking ? BayanTheme.uploadedColor : null,
            ),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const ShiftScreen()),
            ),
          ),
          IconButton(
            tooltip: 'أدوات مساعدة',
            icon: const Icon(Icons.calculate_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const ToolsScreen()),
            ),
          ),
          IconButton(
            tooltip: 'الطباعة والتصدير',
            icon: const Icon(Icons.print_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const PrintScreen()),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'المزيد',
            onSelected: (value) {
              switch (value) {
                case 'catalog':
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(builder: (_) => const CatalogScreen()),
                  );
                case 'statements':
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(builder: (_) => const MyStatementsScreen()),
                  );
                case 'stocktake':
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(builder: (_) => const StocktakeScreen()),
                  );
                case 'lock':
                  _toggleDeviceLock();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'catalog',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.inventory_2_outlined),
                  title: Text('الأصناف والأسعار'),
                ),
              ),
              const PopupMenuItem(
                value: 'statements',
                child: ListTile(
                  dense: true,
                  leading: Icon(Icons.receipt_long_outlined),
                  title: Text('بياناتي'),
                ),
              ),
              if (user?.permissions.contains('stocktake.view') ?? false)
                const PopupMenuItem(
                  value: 'stocktake',
                  child: ListTile(
                    dense: true,
                    leading: Icon(Icons.fact_check_outlined),
                    title: Text('جرد المخزون'),
                  ),
                ),
              CheckedPopupMenuItem(
                value: 'lock',
                checked: lockEnabled,
                child: const ListTile(
                  dense: true,
                  leading: Icon(Icons.lock_outline),
                  title: Text('قفل الجهاز (بصمة)'),
                ),
              ),
            ],
          ),
          IconButton(
            tooltip: 'خروج',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          FloatingActionButton.small(
            heroTag: 'return',
            tooltip: 'مرتجع جديد',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const NewReturnScreen()),
            ),
            child: const Icon(Icons.keyboard_return),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.small(
            heroTag: 'collection',
            tooltip: 'سند قبض',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const NewCollectionScreen()),
            ),
            child: const Icon(Icons.payments_outlined),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.small(
            heroTag: 'handover',
            tooltip: 'تسليم عهدة',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const HandoverScreen()),
            ),
            child: const Icon(Icons.account_balance_wallet_outlined),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.extended(
            heroTag: 'statement',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute<void>(builder: (_) => const NewStatementScreen()),
            ),
            icon: const Icon(Icons.add),
            label: const Text('بيان جديد'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(syncControllerProvider.notifier).syncNow(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (tracking)
              Card(
                color: BayanTheme.uploadedColor.withValues(alpha: 0.12),
                child: ListTile(
                  leading: Icon(Icons.gps_fixed, color: BayanTheme.uploadedColor),
                  title: const Text('تتبع الموقع مُفعّل'),
                  subtitle: const Text('الوردية نشطة — يُرسل موقعك كل دقيقة أثناء العمل'),
                  trailing: TextButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(builder: (_) => const ShiftScreen()),
                    ),
                    child: const Text('عرض'),
                  ),
                ),
              ),
            _syncCard(context, ref, sync, outbox.pending.length),
            if (sync.error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  sync.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 16),
            if (user != null)
              Text('مرحباً، ${user.name}', style: Theme.of(context).textTheme.titleLarge),
            if (user != null && user.repCode != null)
              Text('كود المندوب: ${user.repCode}',
                  style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 16),
            Text('عملائي (${customers.length})',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (customers.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('نزّل البيانات بالأوفلاين ثم استخدم زر المزامنة.'),
                ),
              ),
            for (final c in customers.take(50)) _customerTile(c),
            const SizedBox(height: 16),
            Text('آخر المستندات (${outbox.length})',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (outbox.all.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('لا توجد مستندات بعد.'),
                ),
              ),
            for (final i in outbox.all.take(50))
              Card(
                child: ListTile(
                  dense: true,
                  title: Text(i.number ?? i.clientUuid.substring(0, 8)),
                  subtitle: Text(
                    '${_typeLabel(i.type)} · محاولات: ${i.attempts}'
                    '${i.lastError == null ? '' : ' · ${i.lastError}'}',
                  ),
                  trailing: _StatusChip(status: i.status),
                ),
              ),
            const SizedBox(height: 72),
          ],
        ),
      ),
    );
  }

  Widget _syncCard(BuildContext context, WidgetRef ref, SyncState sync, int ready) {
    final pending = sync.pending;
    final hasIssues = sync.failed > 0 || sync.blocked;
    return Card(
      color: sync.error != null
          ? Theme.of(context).colorScheme.errorContainer
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  sync.running ? Icons.sync : Icons.cloud_done,
                  color: BayanTheme.uploadedColor,
                ),
                const SizedBox(width: 8),
                Text('المزامنة', style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                Text('$pending بانتظار الرفع'),
              ],
            ),
            if (sync.pendingReview > 0) ...[
              const SizedBox(height: 8),
              _syncInfo(
                context,
                icon: Icons.rate_review_outlined,
                color: BayanTheme.pendingReviewColor,
                text: '${sync.pendingReview} بانتظار مراجعة المكتب',
              ),
            ],
            if (sync.failed > 0) ...[
              const SizedBox(height: 8),
              _syncInfo(
                context,
                icon: Icons.error_outline,
                color: BayanTheme.rejectedColor,
                text: '${sync.failed} فشل الرفع',
              ),
            ],
            if (sync.blocked) ...[
              const SizedBox(height: 8),
              _syncInfo(
                context,
                icon: Icons.sync_problem,
                color: BayanTheme.rejectedColor,
                text: 'توقفت المحاولات بعد بلوغ الحد — أعد المحاولة',
              ),
            ],
            if (sync.pricingAlerts.isNotEmpty) ...[
              const SizedBox(height: 8),
              _syncInfo(
                context,
                icon: Icons.warning_amber_rounded,
                color: Colors.amber.shade800,
                text: '${sync.pricingAlerts.length} تنبيه تسعير — راجع الأسعار',
              ),
              const SizedBox(height: 4),
              for (final a in sync.pricingAlerts)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    'الصنف ${a.itemCode}: ${a.unitPrice.toStringAsFixed(2)} '
                    '${_pricingAlertLabel(a.type)} (الحد ${a.threshold.toStringAsFixed(2)})',
                    style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                  ),
                ),
            ],
            const SizedBox(height: 8),
            Text(
              sync.lastSyncAt == null
                  ? 'لم تتم مزامنة بعد'
                  : 'آخر مزامنة: ${sync.lastSyncAt!.toLocal().toString().substring(0, 19)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: sync.running
                        ? null
                        : () => ref.read(syncControllerProvider.notifier).syncNow(),
                    icon: sync.running
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload),
                    label: Text(sync.running ? 'جارٍ المزامنة…' : 'مزامنة الآن'),
                  ),
                ),
                if (hasIssues) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: sync.running
                        ? null
                        : () => ref
                            .read(syncControllerProvider.notifier)
                            .retryFailed(),
                    icon: const Icon(Icons.refresh),
                    label: const Text('إعادة المحاولة'),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _syncInfo(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String text,
  }) =>
      Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      );

  String _pricingAlertLabel(String type) {
    switch (type) {
      case 'below_cost':
        return 'أقل من التكلفة';
      case 'below_min_price':
        return 'أقل من حد السعر الأدنى';
      default:
        return type;
    }
  }

  Widget _customerTile(CustomerSummary c) => Card(
        child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.person)),
          title: Text(c.name),
          subtitle: Text(c.phone ?? c.code),
          trailing: Text(
            c.balance.toStringAsFixed(2),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      );

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