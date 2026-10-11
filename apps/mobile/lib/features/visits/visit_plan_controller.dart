import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/providers.dart';

class VisitPlanState {
  /// خطة اليوم (null قبل أول تحميل؛ بلا خطة → [VisitPlan.id] = null وخطوط فارغة).
  final VisitPlan? plan;

  /// تحميل أولي قيد التنفيذ.
  final bool loading;

  /// تحديث حالة بند قيد التنفيذ.
  final bool busy;

  final String? error;

  const VisitPlanState({this.plan, this.loading = false, this.busy = false, this.error});

  bool get hasPlan => plan != null && !plan!.isEmpty;

  int get remaining => plan == null ? 0 : plan!.total - plan!.doneCount - plan!.missedCount;

  static const _keep = Object();

  /// نسخة محدثة: تمرير null لـ [plan]/[error] يمحو القيمة، والعلامة [_keep] تُبقيها.
  VisitPlanState copy({Object? plan = _keep, bool? loading, bool? busy, Object? error = _keep}) =>
      VisitPlanState(
        plan: identical(plan, _keep) ? this.plan : plan as VisitPlan?,
        loading: loading ?? this.loading,
        busy: busy ?? this.busy,
        error: identical(error, _keep) ? this.error : error as String?,
      );
}

/// يدير خطة زيارات اليوم للمندوب: جلب الخطة وتحديث حالة كل بند (§5.12).
class VisitPlanController extends Notifier<VisitPlanState> {
  @override
  VisitPlanState build() => const VisitPlanState();

  ApiClient get _api => ref.read(apiClientProvider);

  Future<void> refresh() async {
    state = state.copy(loading: true, error: null);
    try {
      final plan = await _api.todayVisitPlan();
      state = VisitPlanState(plan: plan);
    } catch (e) {
      state = state.copy(loading: false, error: _message(e, 'فشل جلب خطة الزيارات'));
    }
  }

  /// يعلّم بند الزيارة «تمت» أو «لم تتم» عبر الخادم (بسبب اختياري لـ «لم تتم»).
  Future<bool> mark({required int lineId, required bool missed, String? reason}) async {
    final plan = state.plan;
    if (plan?.id == null || state.busy) return false;
    state = state.copy(busy: true, error: null);
    final notes = missed && reason != null && reason.trim().isNotEmpty ? reason.trim() : null;
    try {
      final updated = await _api.setVisitPlanLineStatus(
        planId: plan!.id!,
        lineId: lineId,
        status: missed ? 'MISSED' : 'DONE',
        notes: notes,
      );
      state = VisitPlanState(plan: updated);
      return true;
    } catch (e) {
      state = state.copy(busy: false, error: _message(e, 'فشل تحديث حالة الزيارة'));
      return false;
    }
  }

  void clearError() => state = state.copy(error: null);

  String _message(Object e, String fallback) {
    if (e is ApiException) return e.message;
    return fallback;
  }
}

final visitPlanControllerProvider =
    NotifierProvider<VisitPlanController, VisitPlanState>(VisitPlanController.new);