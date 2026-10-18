import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/models.dart';
import '../../core/outbox.dart';
import '../../core/providers.dart';

class SyncState {
  final bool running;
  final int pending;
  final int failed;
  final int pendingReview;
  final bool blocked;
  final int total;
  final DateTime? lastSyncAt;
  final String? error;

  /// تنبيهات التسعير (§5.3) المعادة من الخادم مع آخر رفع لبيانات سعر.
  final List<PricingAlert> pricingAlerts;

  const SyncState({
    this.running = false,
    this.pending = 0,
    this.failed = 0,
    this.pendingReview = 0,
    this.blocked = false,
    this.total = 0,
    this.lastSyncAt,
    this.error,
    this.pricingAlerts = const [],
  });
}

class SyncController extends Notifier<SyncState> {
  StreamSubscription<bool>? _connSub;

  @override
  SyncState build() {
    final outbox = ref.read(outboxProvider);
    // §5.12: رفع تلقائي عند عودة الاتصال إن وُجد ما ينتظر الرفع.
    _connSub = ref.read(connectivityProvider).onChanged.listen((online) {
      if (online && !state.running && state.pending > 0) {
        syncNow();
      }
    });
    ref.onDispose(() => _connSub?.cancel());
    return _snapshot(outbox, lastSyncAt: ref.read(sessionProvider).lastSyncAt);
  }

  Outbox get _outbox => ref.read(outboxProvider);

  SyncState _snapshot(
    Outbox outbox, {
    DateTime? lastSyncAt,
    bool running = false,
    String? error,
    List<PricingAlert> pricingAlerts = const [],
  }) =>
      SyncState(
        running: running,
        pending: outbox.pending.length,
        failed: outbox.failedCount,
        pendingReview: outbox.pendingReviewCount,
        blocked: outbox.hasReachedMaxAttempts,
        total: outbox.length,
        lastSyncAt: lastSyncAt,
        error: error,
        pricingAlerts: pricingAlerts,
      );

  void refresh() {
    state = _snapshot(
      _outbox,
      lastSyncAt: ref.read(sessionProvider).lastSyncAt,
      running: state.running,
      error: state.error,
    );
  }

  /// يضيف مستنداً أُنشئ أوفلاين إلى الصندوق ويحفظه.
  bool enqueue({
    required String type,
    required Map<String, dynamic> payload,
    String? number,
  }) {
    final item = OutboxItem(
      clientUuid: const Uuid().v4(),
      type: type,
      payload: payload,
      number: number,
      createdAt: DateTime.now(),
    );
    final added = _outbox.add(item);
    if (added) {
      _persist();
      refresh();
    }
    return added;
  }

  /// يعيد ضبط العناصر التي استنفدت محاولاتها ثم يزامن فوراً.
  Future<void> retryFailed() async {
    if (state.running) return;
    _outbox.resetAttempts(DateTime.now());
    await _persist();
    refresh();
    await syncNow();
  }

  Future<void> syncNow() async {
    if (state.running) return;
    state = _snapshot(
      _outbox,
      lastSyncAt: ref.read(sessionProvider).lastSyncAt,
      running: true,
    );

    final outbox = _outbox;
    final api = ref.read(apiClientProvider);
    final session = ref.read(sessionProvider);
    final store = ref.read(dataStoreProvider);
    final now = DateTime.now();

    try {
      final ready = outbox.ready(now);
      var collectedAlerts = <PricingAlert>[];
      if (ready.isNotEmpty) {
        for (final i in ready) {
          outbox.markUploading(i.clientUuid);
        }
        final results = await api.push(ready);
        for (final r in results) {
          if (r.status == SyncStatus.local) {
            outbox.markFailure(r.clientUuid, r.error ?? 'مرفوض من الخادم', now);
          } else {
            outbox.markSuccess(r.clientUuid, status: r.status, serverId: r.serverId);
          }
          collectedAlerts.addAll(r.pricingAlerts);
        }
        // أي عنصر لم يرد عنه خبر ⇒ أعد المحاولة لاحقاً.
        for (final i in ready) {
          if (i.status == SyncStatus.uploading) {
            outbox.markFailure(i.clientUuid, 'لم يرد الخادم', now);
          }
        }
      }

      final delta = await api.delta(since: store.lastDelta);
      if (delta.items.isNotEmpty) await store.saveItems(delta.items);
      if (delta.customers.isNotEmpty) await store.saveCustomers(delta.customers);
      if (delta.priceLists.isNotEmpty) await store.savePriceLists(delta.priceLists);
      if (delta.statements.isNotEmpty) await store.saveStatements(delta.statements);
      if (delta.blocks.isNotEmpty) {
        await ref.read(numberingProvider).applyBlocks(delta.blocks);
      }
      await store.saveLastDelta(delta.serverTime);

      final at = DateTime.now();
      await session.saveLastSync(at);
      await _persist();

      state = _snapshot(outbox, lastSyncAt: at, pricingAlerts: collectedAlerts);
    } catch (e) {
      _resetUploading();
      await _persist();
      state = _snapshot(outbox, lastSyncAt: session.lastSyncAt, error: e.toString());
    }
  }

  void _resetUploading() {
    for (final i in _outbox.all) {
      if (i.status == SyncStatus.uploading) i.status = SyncStatus.local;
    }
  }

  Future<void> _persist() =>
      ref.read(sessionProvider).saveOutbox(_outbox.toJson());
}

final syncControllerProvider =
    NotifierProvider<SyncController, SyncState>(SyncController.new);