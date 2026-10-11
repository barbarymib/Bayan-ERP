import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/outbox.dart';
import '../../core/providers.dart';

/// إجمالي القبض النقدي غير المُسلَّم لليوم — يُستخدم لاقتراح مبلغ تسليم العهدة.
double todayCashCollected(Iterable<OutboxItem> items, DateTime now) {
  final day = DateTime(now.year, now.month, now.day);
  double sum = 0;
  for (final i in items) {
    if (i.type != 'receipt') continue;
    if (((i.payload['method'] as String?) ?? 'CASH') != 'CASH') continue;
    final raw = i.payload['receivedAt']?.toString();
    final when = (raw != null ? DateTime.tryParse(raw) : null)?.toLocal() ?? i.createdAt.toLocal();
    if (DateTime(when.year, when.month, when.day) != day) continue;
    final amount = i.payload['amount'];
    if (amount is num) {
      sum += amount.toDouble();
    } else if (amount is String) {
      sum += double.tryParse(amount) ?? 0;
    }
  }
  return sum;
}

class HandoverState {
  /// إرسال محضر التسليم قيد التنفيذ.
  final bool submitting;

  final String? error;

  /// آخر محضر ناجح.
  final CustodyHandover? result;

  const HandoverState({this.submitting = false, this.error, this.result});

  bool get done => result != null;

  static const _keep = Object();

  /// نسخة محدثة: تمرير null لـ [error]/[result] يمحو القيمة، والعلامة [_keep] تُبقيها.
  HandoverState copy({bool? submitting, Object? error = _keep, Object? result = _keep}) =>
      HandoverState(
        submitting: submitting ?? this.submitting,
        error: identical(error, _keep) ? this.error : error as String?,
        result: identical(result, _keep) ? this.result : result as CustodyHandover?,
      );
}

/// يسلّم المندوب النقدية المحصّلة للخزينة عبر محضر تسليم عهدة (§5.10).
class HandoverController extends Notifier<HandoverState> {
  @override
  HandoverState build() => const HandoverState();

  ApiClient get _api => ref.read(apiClientProvider);

  /// يرسل محضر التسليم للمندوب الحالي. يعيد المحضر عند النجاح أو null عند الفشل.
  Future<CustodyHandover?> submit({
    required double amount,
    String? notes,
    DateTime? date,
    int? cashAccountId,
  }) async {
    if (state.submitting) return null;
    final user = ref.read(sessionProvider).user;
    if (user == null) {
      state = state.copy(error: 'لا يوجد مستخدم مسجّل');
      return null;
    }
    if (amount <= 0) {
      state = state.copy(error: 'أدخل مبلغاً صحيحاً');
      return null;
    }
    state = state.copy(submitting: true, error: null, result: null);
    try {
      final handover = await _api.createHandover(
        repId: user.id,
        amount: amount,
        date: date,
        cashAccountId: cashAccountId,
        notes: notes,
      );
      state = HandoverState(result: handover);
      return handover;
    } catch (e) {
      state = state.copy(
        submitting: false,
        error: e is ApiException ? e.message : 'فشل تسجيل تسليم العهدة',
      );
      return null;
    }
  }

  void reset() => state = const HandoverState();
}

final handoverControllerProvider =
    NotifierProvider<HandoverController, HandoverState>(HandoverController.new);
