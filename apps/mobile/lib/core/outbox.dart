import 'dart:convert';

import 'models.dart';

/// سياسة التراجع الأسي (Exponential Backoff).
/// المحاولة 1: 2ث، 2: 4ث، 3: 8ث … بحد أقصى 5 دقائق، مع ارتجاج حتمي للاختبار.
class BackoffPolicy {
  final Duration base;
  final Duration max;
  final int maxAttempts;

  const BackoffPolicy({
    this.base = const Duration(seconds: 2),
    this.max = const Duration(minutes: 5),
    this.maxAttempts = 8,
  });

  Duration delayFor(int attempt, {int jitterSeed = 0}) =>
      backoffDelay(attempt, base: base, max: max, jitterSeed: jitterSeed);
}

/// دالة تراجع نقية وسهلة الاختبار.
/// [attempt] عدد المحاولات الفاشلة (1 يعني الارتجاع الأول).
Duration backoffDelay(
  int attempt, {
  Duration base = const Duration(seconds: 2),
  Duration max = const Duration(minutes: 5),
  int jitterSeed = 0,
}) {
  if (attempt <= 0) return Duration.zero;
  final exp = attempt - 1;
  final double raw = base.inMilliseconds * _pow2(exp).toDouble();
  final double capped = raw > max.inMilliseconds ? max.inMilliseconds.toDouble() : raw;
  return Duration(milliseconds: capped.round() + _jitter(attempt, base.inMilliseconds, jitterSeed));
}

int _pow2(int n) {
  var r = 1;
  for (var i = 0; i < n && r < (1 << 52); i++) {
    r *= 2;
  }
  return r;
}

/// ارتجاج حتمي في المجال [0, base/2] مشتق من رقم المحاولة والبذرة.
int _jitter(int attempt, int baseMs, int seed) {
  if (baseMs <= 0) return 0;
  final span = (baseMs ~/ 2) + 1;
  var x = attempt * 2654435761 + seed * 40503;
  x &= 0x7fffffff;
  return x % span;
}

/// عنصر في صندوق الصادر يحمل بياناً/مرتجعاً/تحصيلاً أُنشئ أوفلاين.
class OutboxItem {
  final String clientUuid;
  final String type;
  final Map<String, dynamic> payload;
  final String? number;
  final DateTime createdAt;
  SyncStatus status;
  int attempts;
  DateTime nextAttemptAt;
  String? lastError;
  int? serverId;

  OutboxItem({
    required this.clientUuid,
    required this.type,
    required this.payload,
    this.number,
    required this.createdAt,
    this.status = SyncStatus.local,
    this.attempts = 0,
    DateTime? nextAttemptAt,
    this.lastError,
    this.serverId,
  }) : nextAttemptAt = nextAttemptAt ?? createdAt;

  Map<String, dynamic> toJson() => {
        'clientUuid': clientUuid,
        'type': type,
        'payload': payload,
        'number': number,
        'status': status.name,
        'attempts': attempts,
        'createdAt': createdAt.toIso8601String(),
        'nextAttemptAt': nextAttemptAt.toIso8601String(),
        'lastError': lastError,
        'serverId': serverId,
      };

  factory OutboxItem.fromJson(Map<String, dynamic> j) => OutboxItem(
        clientUuid: j['clientUuid'] as String,
        type: j['type'] as String,
        payload: (j['payload'] as Map).cast<String, dynamic>(),
        number: j['number'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        status: SyncStatus.values.firstWhere(
          (s) => s.name == j['status'],
          orElse: () => SyncStatus.local,
        ),
        attempts: (j['attempts'] as num?)?.toInt() ?? 0,
        nextAttemptAt: j['nextAttemptAt'] == null
            ? null
            : DateTime.parse(j['nextAttemptAt'] as String),
        lastError: j['lastError'] as String?,
        serverId: (j['serverId'] as num?)?.toInt(),
      );
}

/// صندوق الصادر: FIFO، منع تكرار `clientUuid`، وإدارة إعادة المحاولة.
class Outbox {
  final List<OutboxItem> _items = [];
  final BackoffPolicy policy;

  Outbox({this.policy = const BackoffPolicy()});

  List<OutboxItem> get all => List.unmodifiable(_items);
  int get length => _items.length;
  bool get isEmpty => _items.isEmpty;

  List<OutboxItem> get pending => _items.where((i) => !i.status.isTerminal).toList();

  int get failedCount =>
      _items.where((i) => i.status == SyncStatus.local && i.attempts > 0).length;

  /// عدد العناصر التي رُفعت وتنتظر مراجعة المكتب (تغيّر السعر/الرصيد أوفلاين).
  int get pendingReviewCount =>
      _items.where((i) => i.status == SyncStatus.pendingReview).length;

  bool get hasReachedMaxAttempts =>
      _items.any((i) => !i.status.isTerminal && i.attempts >= policy.maxAttempts);

  /// يضيف عنصراً إن لم يكن موجوداً. يعيد false عند التكرار.
  bool add(OutboxItem item) {
    if (_items.any((i) => i.clientUuid == item.clientUuid)) return false;
    _items.add(item);
    return true;
  }

  OutboxItem? byUuid(String uuid) {
    for (final i in _items) {
      if (i.clientUuid == uuid) return i;
    }
    return null;
  }

  /// العناصر الجاهزة للرفع الآن (FIFO، لم تستنفد المحاولات، وحان وقتها).
  List<OutboxItem> ready(DateTime now) {
    final r = _items
        .where((i) => !i.status.isTerminal)
        .where((i) => i.attempts < policy.maxAttempts)
        .where((i) => i.attempts == 0 || !i.nextAttemptAt.isAfter(now))
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return r;
  }

  void markUploading(String uuid) {
    byUuid(uuid)?.status = SyncStatus.uploading;
  }

  void markSuccess(String uuid, {SyncStatus status = SyncStatus.uploaded, int? serverId}) {
    final i = byUuid(uuid);
    if (i == null) return;
    i.status = status;
    if (serverId != null) i.serverId = serverId;
    i.lastError = null;
  }

  /// يسجّل فشل المحاولة ويحدد موعد المحاولة التالية وفق [policy].
  void markFailure(String uuid, String error, DateTime now, {int jitterSeed = 0}) {
    final i = byUuid(uuid);
    if (i == null) return;
    i.attempts += 1;
    i.lastError = error;
    i.status = SyncStatus.local;
    i.nextAttemptAt = now.add(policy.delayFor(i.attempts, jitterSeed: jitterSeed));
  }

  void replaceAll(Iterable<OutboxItem> items) {
    _items
      ..clear()
      ..addAll(items);
  }

  /// يعيد ضبط المحاولات الفاشلة كي تصبح جاهزة للرفع فوراً (زر «إعادة المحاولة»).
  /// لا يمسّ العناصر النهائية، ويعيد عدد ما أُعيد ضبطه.
  int resetAttempts([DateTime? now]) {
    final at = now ?? DateTime.now();
    var reset = 0;
    for (final i in _items) {
      if (!i.status.isTerminal && i.attempts > 0) {
        i.attempts = 0;
        i.lastError = null;
        i.nextAttemptAt = at;
        reset++;
      }
    }
    return reset;
  }

  String toJson() => jsonEncode(_items.map((i) => i.toJson()).toList());

  static Outbox fromJson(String? raw, {BackoffPolicy policy = const BackoffPolicy()}) {
    final outbox = Outbox(policy: policy);
    if (raw == null || raw.trim().isEmpty) return outbox;
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    outbox.replaceAll(list.map(OutboxItem.fromJson));
    return outbox;
  }
}