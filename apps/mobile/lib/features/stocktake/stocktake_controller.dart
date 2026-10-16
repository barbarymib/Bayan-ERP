import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/outbox.dart';
import '../../core/providers.dart';
import '../sync/sync_controller.dart';

/// ملخص جلسة جرد كما يظهر في قائمة الموبايل (§5.8 خطوة 3).
class StocktakeSession {
  final int id;
  final String number;
  final String status;
  final String warehouseName;
  final int lineCount;
  final DateTime? openedAt;

  const StocktakeSession({
    required this.id,
    required this.number,
    required this.status,
    required this.warehouseName,
    required this.lineCount,
    this.openedAt,
  });

  /// الجلسة قابلة للعدّ من الموبايل (OPEN/COUNTING)؛ غيرها للمراجعة/الاعتماد.
  bool get isCountable => status == 'OPEN' || status == 'COUNTING';

  factory StocktakeSession.fromJson(Map<String, dynamic> j) {
    final warehouse = (j['warehouse'] as Map?)?.cast<String, dynamic>();
    final count = (j['_count'] as Map?)?.cast<String, dynamic>();
    return StocktakeSession(
      id: (j['id'] as num).toInt(),
      number: (j['number'] ?? '').toString(),
      status: (j['status'] ?? '').toString(),
      warehouseName:
          (warehouse?['nameAr'] ?? warehouse?['code'] ?? '').toString(),
      lineCount: (count?['lines'] as num?)?.toInt() ?? 0,
      openedAt: DateTime.tryParse((j['openedAt'] ?? '').toString()),
    );
  }
}

/// بند جرد: الصنف + رصيد النظام + العدّ المحفوظ سابقاً (إن وُجد).
class StocktakeLine {
  final int itemId;
  final String code;
  final String name;
  final String batchId;
  final double systemQty;
  final double? countedQty;
  final double? lastCost;
  final bool trackBatch;

  const StocktakeLine({
    required this.itemId,
    required this.code,
    required this.name,
    required this.batchId,
    required this.systemQty,
    this.countedQty,
    this.lastCost,
    this.trackBatch = false,
  });

  /// مفتاح البند الفريد (itemId + الدفعة) — يطابق مفتاح upsert على الخادم.
  String get key => '$itemId|$batchId';

  factory StocktakeLine.fromJson(Map<String, dynamic> j) {
    final item = (j['item'] as Map?)?.cast<String, dynamic>();
    return StocktakeLine(
      itemId: (j['itemId'] as num).toInt(),
      code: (item?['code'] ?? '').toString(),
      name: (item?['nameAr'] ?? '').toString(),
      batchId: (j['batchId'] ?? '').toString(),
      systemQty: _numOr(j['systemQtyBase']) ?? 0,
      countedQty: _numOr(j['countedQtyBase']),
      lastCost: _numOr(j['lastCost']),
      trackBatch: item?['trackBatch'] == true,
    );
  }
}

/// يحوّل حقول Decimal (تُسلسل نصاً من Prisma) أو الأرقام إلى double.
double? _numOr(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

class StocktakeListState {
  final bool loading;
  final bool offline;
  final String? error;
  final List<StocktakeSession> sessions;
  final DateTime? loadedAt;

  const StocktakeListState({
    this.loading = false,
    this.offline = false,
    this.error,
    this.sessions = const [],
    this.loadedAt,
  });
}

class StocktakeCountState {
  final int sessionId;
  final bool loading;
  final bool saving;
  final bool offline;
  final String? error;
  final String number;
  final String status;
  final String warehouseName;
  final List<StocktakeLine> lines;
  final Map<String, double> entered;
  final DateTime? queuedAt;

  const StocktakeCountState({
    this.sessionId = 0,
    this.loading = false,
    this.saving = false,
    this.offline = false,
    this.error,
    this.number = '',
    this.status = '',
    this.warehouseName = '',
    this.lines = const [],
    this.entered = const {},
    this.queuedAt,
  });

  bool get editable => status == 'OPEN' || status == 'COUNTING';

  int get countedCount =>
      lines.where((l) => entered.containsKey(l.key)).length;

  StocktakeCountState copyWith({
    bool? loading,
    bool? saving,
    bool? offline,
    String? error,
    bool clearError = false,
    String? number,
    String? status,
    String? warehouseName,
    List<StocktakeLine>? lines,
    Map<String, double>? entered,
    DateTime? queuedAt,
  }) =>
      StocktakeCountState(
        sessionId: sessionId,
        loading: loading ?? this.loading,
        saving: saving ?? this.saving,
        offline: offline ?? this.offline,
        error: clearError ? null : (error ?? this.error),
        number: number ?? this.number,
        status: status ?? this.status,
        warehouseName: warehouseName ?? this.warehouseName,
        lines: lines ?? this.lines,
        entered: entered ?? this.entered,
        queuedAt: queuedAt ?? this.queuedAt,
      );
}

/// نوع عنصر صندوق الصادر الخاص بعدّات الجرد.
const stocktakeOutboxType = 'stocktake';

/// يخزّن/يقرأ قائمة الجلسات محلياً ليتيح العدّ أوفلاين بعد أول تحميل.
class StocktakeListController extends Notifier<StocktakeListState> {
  static const _cacheKey = 'stocktake.sessions';

  @override
  StocktakeListState build() => const StocktakeListState();

  Future<void> load() async {
    state = const StocktakeListState(loading: true);
    final api = ref.read(apiClientProvider);
    final store = ref.read(dataStoreProvider);
    try {
      final rows = await api.stocktakeSessions();
      await store.writeMeta(_cacheKey, jsonEncode(rows));
      state = StocktakeListState(
        sessions: rows.map(StocktakeSession.fromJson).toList(),
        loadedAt: DateTime.now(),
      );
    } catch (e) {
      final cached = await _readCache();
      state = StocktakeListState(
        sessions: cached,
        offline: cached.isNotEmpty,
        error: e.toString(),
      );
    }
  }

  Future<List<StocktakeSession>> _readCache() async {
    final raw = await ref.read(dataStoreProvider).readMeta(_cacheKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      return (jsonDecode(raw) as List)
          .map((e) => StocktakeSession.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } catch (_) {
      return const [];
    }
  }
}

/// يفتح جلسة جرد، يدير إدخال الكميات المعدودة، ويرفعها عبر صندوق الصادر
/// (تُطبَّق على الخادم بـ upsert لكل (جلسة، صنف، دفعة) فهي آمنة التكرار).
class StocktakeCountController extends Notifier<StocktakeCountState> {
  @override
  StocktakeCountState build() => const StocktakeCountState();

  Future<void> open(int sessionId) async {
    state = StocktakeCountState(sessionId: sessionId, loading: true);
    final api = ref.read(apiClientProvider);
    final cacheKey = 'stocktake.detail.$sessionId';
    try {
      final detail = await api.stocktakeDetail(sessionId);
      await ref.read(dataStoreProvider).writeMeta(cacheKey, jsonEncode(detail));
      state = _fromDetail(detail);
    } catch (e) {
      final raw = await ref.read(dataStoreProvider).readMeta(cacheKey);
      if (raw == null || raw.isEmpty) {
        state = state.copyWith(loading: false, error: e.toString());
        return;
      }
      state = _fromDetail(
        (jsonDecode(raw) as Map).cast<String, dynamic>(),
        offline: true,
        error: e.toString(),
      );
    }
    _seedEnteredFromOutbox();
  }

  StocktakeCountState _fromDetail(
    Map<String, dynamic> detail, {
    bool offline = false,
    String? error,
  }) {
    final warehouse = (detail['warehouse'] as Map?)?.cast<String, dynamic>();
    final lines = ((detail['lines'] as List?) ?? const [])
        .map((e) => StocktakeLine.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return StocktakeCountState(
      sessionId: (detail['id'] as num?)?.toInt() ?? state.sessionId,
      number: (detail['number'] ?? '').toString(),
      status: (detail['status'] ?? '').toString(),
      warehouseName:
          (warehouse?['nameAr'] ?? warehouse?['code'] ?? '').toString(),
      lines: lines,
      offline: offline,
      error: error,
    );
  }

  /// يستعيد الكميات التي أدخلها المستخدم ولم تُرفع بعد (بعد إغلاق التطبيق مثلاً).
  void _seedEnteredFromOutbox() {
    for (final i in ref.read(outboxProvider).all) {
      if (i.type != stocktakeOutboxType || i.status.isTerminal) continue;
      if ((i.payload['sessionId'] as num?)?.toInt() != state.sessionId) continue;
      final entered = <String, double>{...state.entered};
      for (final r in (i.payload['counts'] as List?) ?? const []) {
        final m = (r as Map).cast<String, dynamic>();
        final qty = m['qty'];
        if (qty is num) entered['${m['itemId']}|${m['batchId'] ?? ''}'] = qty.toDouble();
      }
      if (entered.isNotEmpty) state = state.copyWith(entered: entered);
      return;
    }
  }

  /// يحدّث كمية بند (بالوحدة الأساسية). قيمة سالبة تُهمَل.
  void setCount(String key, double qty) {
    if (!state.editable) return;
    final entered = <String, double>{...state.entered};
    if (qty < 0) {
      entered.remove(key);
    } else {
      entered[key] = qty;
    }
    state = state.copyWith(entered: entered);
  }

  void clearCount(String key) {
    final entered = <String, double>{...state.entered}..remove(key);
    state = state.copyWith(entered: entered);
  }

  /// يجمع العدّات المدخلة في عنصر صندوق الصادر ورفعه فوراً إن توفّر الاتصال.
  /// يعيد عدد البنود المحفوظة، أو null إن لم يُدخل شيء.
  Future<int?> save() async {
    if (state.lines.isEmpty) return null;
    final counts = <Map<String, dynamic>>[];
    for (final l in state.lines) {
      final q = state.entered[l.key];
      if (q == null) continue;
      counts.add({'itemId': l.itemId, 'batchId': l.batchId, 'qty': q});
    }
    if (counts.isEmpty) {
      state = state.copyWith(error: 'أدخل كمية بند واحد على الأقل');
      return null;
    }

    state = state.copyWith(saving: true, clearError: true);
    final payload = <String, dynamic>{
      'sessionId': state.sessionId,
      'counts': counts,
    };
    final outbox = ref.read(outboxProvider);
    // دمج مع عنصر معلّق لنفس الجلسة بدل تكديس عناصر في كل حفظ.
    final merged =
        outbox.updatePendingOfType(stocktakeOutboxType, state.sessionId, payload);
    if (!merged) {
      outbox.add(OutboxItem(
        clientUuid: const Uuid().v4(),
        type: stocktakeOutboxType,
        payload: payload,
        createdAt: DateTime.now(),
      ));
    }
    await ref.read(sessionProvider).saveOutbox(outbox.toJson());
    ref.read(syncControllerProvider.notifier).refresh();
    // الرفع الفوري محاولة فقط؛ إن كان الجهاز أوفلاين يبقى العنصر معلّقاً.
    await ref.read(syncControllerProvider.notifier).syncNow();
    state = state.copyWith(saving: false, queuedAt: DateTime.now());
    return counts.length;
  }
}

final stocktakeListProvider =
    NotifierProvider<StocktakeListController, StocktakeListState>(
  StocktakeListController.new,
);

final stocktakeCountProvider =
    NotifierProvider<StocktakeCountController, StocktakeCountState>(
  StocktakeCountController.new,
);
