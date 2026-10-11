import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import 'visit_plan_controller.dart';

class VisitPlanScreen extends ConsumerStatefulWidget {
  const VisitPlanScreen({super.key});

  @override
  ConsumerState<VisitPlanScreen> createState() => _VisitPlanScreenState();
}

class _VisitPlanScreenState extends ConsumerState<VisitPlanScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(visitPlanControllerProvider.notifier).refresh());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(visitPlanControllerProvider);
    final controller = ref.read(visitPlanControllerProvider.notifier);
    final plan = state.plan;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('خطة الزيارات')),
      body: RefreshIndicator(
        onRefresh: controller.refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (state.error != null)
              Card(
                color: theme.colorScheme.errorContainer,
                child: ListTile(
                  leading: Icon(Icons.error_outline, color: theme.colorScheme.onErrorContainer),
                  title: Text(state.error!, style: TextStyle(color: theme.colorScheme.onErrorContainer)),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: controller.clearError,
                  ),
                ),
              ),
            const SizedBox(height: 8),
            if (state.loading && plan == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (plan == null || plan.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(Icons.event_note_outlined, size: 48, color: Colors.grey),
                      SizedBox(height: 8),
                      Text('لا توجد خطة زيارات لليوم.', textAlign: TextAlign.center),
                    ],
                  ),
                ),
              )
            else ...[
              _progressCard(context, plan),
              if (plan.notes != null && plan.notes!.trim().isNotEmpty)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.sticky_note_2_outlined),
                    title: Text(plan.notes!),
                  ),
                ),
              const SizedBox(height: 8),
              for (final line in plan.lines) _lineCard(context, line, controller, state.busy),
            ],
          ],
        ),
      ),
    );
  }

  Widget _progressCard(BuildContext context, VisitPlan plan) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.task_alt, color: Colors.green.shade600),
            const SizedBox(width: 8),
            Text(
              'تم ${plan.doneCount} من ${plan.total}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Spacer(),
            Text(
              plan.missedCount == 0 ? 'بمتابعة جيدة' : 'لم تتم ${plan.missedCount}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _lineCard(
    BuildContext context,
    VisitPlanLine line,
    VisitPlanController controller,
    bool busy,
  ) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: _statusColor(context, line).withValues(alpha: 0.15),
                  child: Text('${line.sequence}', style: const TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(line.customerName,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(
                        [
                          if (line.customerCode != null && line.customerCode!.isNotEmpty) 'كود ${line.customerCode}',
                          if (line.customerPhone != null && line.customerPhone!.isNotEmpty) line.customerPhone!,
                        ].join(' · '),
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                _statusChip(context, line),
              ],
            ),
            if (line.notes != null && line.notes!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6, right: 6),
                child: Text(
                  'سبب: ${line.notes}',
                  style: theme.textTheme.bodySmall,
                ),
              ),
            if (line.isPlanned)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: busy ? null : () => controller.mark(lineId: line.id, missed: false),
                      icon: const Icon(Icons.check_circle_outline, size: 18),
                      label: const Text('تمت الزيارة'),
                      style: TextButton.styleFrom(foregroundColor: Colors.green.shade700),
                    ),
                    const SizedBox(width: 4),
                    TextButton.icon(
                      onPressed:
                          busy ? null : () => _confirmMissed(context, controller, line),
                      icon: const Icon(Icons.cancel_outlined, size: 18),
                      label: const Text('لم تتم'),
                      style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(BuildContext context, VisitPlanLine line) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _statusColor(context, line).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        line.isDone ? 'تمت' : line.isMissed ? 'لم تتم' : 'مجدولة',
        style: TextStyle(
          color: _statusColor(context, line),
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Color _statusColor(BuildContext context, VisitPlanLine line) {
    if (line.isDone) return Colors.green.shade600;
    if (line.isMissed) return Theme.of(context).colorScheme.error;
    return Colors.grey.shade600;
  }

  Future<void> _confirmMissed(
    BuildContext context,
    VisitPlanController controller,
    VisitPlanLine line,
  ) async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('تسجيل «لم تتم» — ${line.customerName}'),
        content: TextField(
          controller: reason,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'السبب (اختياري)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حفظ')),
        ],
      ),
    );
    final text = reason.text;
    reason.dispose();
    if (confirmed == true) {
      await controller.mark(
        lineId: line.id,
        missed: true,
        reason: text,
      );
    }
  }
}