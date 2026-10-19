import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import 'today_kpis_view.dart';

class TodayKpisState {
  final TodayKpis? kpis;

  /// تحميل أولي/تحديث قيد التنفيذ.
  final bool loading;

  /// لا يوجد اتصال والمؤشرات معروضة من الكاش (بمثابة بيانات اليوم).
  final bool offline;

  final String? error;

  const TodayKpisState({this.kpis, this.loading = false, this.offline = false, this.error});

  static const _keep = Object();

  /// نسخة محدثة: تمرير null لـ [error] يمحو الخطأ، وعلامة [_keep] تُبقي الحالة.
  TodayKpisState copy({
    TodayKpis? kpis,
    bool? loading,
    bool? offline,
    Object? error = _keep,
  }) =>
      TodayKpisState(
        kpis: kpis ?? this.kpis,
        loading: loading ?? this.loading,
        offline: offline ?? this.offline,
        error: identical(error, _keep) ? this.error : error as String?,
      );
}

/// يجلب مؤشرات أداء المندوب ليومه (§8.2 #1) من `/reports/rep-performance`
/// بمرشّح `repId` + `from=to=اليوم`، ويحفظ النتيجة في كاش مؤقّت لتعمل
/// الرئيسية أوفلاين (يُرفض كاش يومٍ آخر حتى لا تُعرض أرقام مغلوطة).
class TodayKpisController extends Notifier<TodayKpisState> {
  static const _cacheKey = 'home.today_kpis';

  @override
  TodayKpisState build() => const TodayKpisState();

  ApiClient get _api => ref.read(apiClientProvider);

  Future<void> refresh() async {
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    state = state.copy(loading: true, error: null);
    final today = dayFilter(DateTime.now());
    final store = ref.read(dataStoreProvider);
    try {
      final json = await _api.repPerformance(repId: user.id, from: today, to: today);
      await store.writeMeta(_cacheKey, jsonEncode({'day': today, 'payload': json}));
      state = TodayKpisState(
        kpis: TodayKpis.fromResponse(json, repId: user.id, fallbackDate: DateTime.now()),
      );
    } catch (e) {
      final cached = await _readCache(today, user.id);
      state = TodayKpisState(
        kpis: cached,
        offline: cached != null,
        error: cached == null ? _message(e) : null,
      );
    }
  }

  Future<TodayKpis?> _readCache(String today, int repId) async {
    final raw = await ref.read(dataStoreProvider).readMeta(_cacheKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final envelope = (jsonDecode(raw) as Map).cast<String, dynamic>();
      if (envelope['day'] != today) return null;
      final payload = (envelope['payload'] as Map).cast<String, dynamic>();
      return TodayKpis.fromResponse(payload, repId: repId, fallbackDate: DateTime.now());
    } catch (_) {
      return null;
    }
  }

  void clearError() => state = state.copy(error: null);

  String _message(Object e) {
    if (e is ApiException) return e.message;
    return 'تعذّر جلب مؤشرات اليوم';
  }
}

final todayKpisControllerProvider =
    NotifierProvider<TodayKpisController, TodayKpisState>(TodayKpisController.new);
