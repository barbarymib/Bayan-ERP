import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'calc/numbering.dart';
import 'models.dart' as api;

/// نطاق ترقيم جهاز واحد: من/التالي/إلى.
class NumberingRange {
  final int from;
  int next;
  int to;

  NumberingRange({required this.from, required this.next, required this.to});

  int get used => next - from;
  int get remaining => to - next + 1;

  Map<String, dynamic> toJson() => {'from': from, 'next': next, 'to': to};

  factory NumberingRange.fromJson(Map<String, dynamic> j) => NumberingRange(
        from: (j['from'] as num).toInt(),
        next: (j['next'] as num).toInt(),
        to: (j['to'] as num).toInt(),
      );
}

/// مُخصِّص الأرقام الأوفلاين — يستهلك كتل الأرقام التي يحجزها الخادم للجهاز.
/// الجزء النقي قابل للاختبار مستقلاً عن التخزين.
class NumberingState {
  final Map<String, NumberingRange> ranges;

  NumberingState([Map<String, NumberingRange>? initial])
      : ranges = initial ?? {};

  static String keyOf(String prefix, String repCode) => '$prefix|$repCode';

  /// يطبّق كتل الأرقام القادمة من `delta` (يبقي الأكبر `to`، ويهيّئ `next` أول مرة).
  void applyBlocks(Iterable<api.NumberBlock> blocks) {
    for (final b in blocks) {
      final key = keyOf(b.kind, b.repCode);
      final existing = ranges[key];
      if (existing == null) {
        ranges[key] = NumberingRange(from: b.from, next: b.from, to: b.to);
      } else if (b.to > existing.to) {
        existing.to = b.to;
      }
    }
  }

  bool hasBlock(String prefix, String repCode) =>
      ranges.containsKey(keyOf(prefix, repCode));

  bool canIssue(String prefix, String repCode) {
    final r = ranges[keyOf(prefix, repCode)];
    return r != null && r.next <= r.to;
  }

  /// يعيد رقم المستند التالي ويستهلكه. يعيد `null` إن لا توجد كتلة/استُنفدت.
  String? next(String prefix, String repCode) {
    final r = ranges[keyOf(prefix, repCode)];
    if (r == null || r.next > r.to) return null;
    final seq = r.next;
    r.next = seq + 1;
    return formatDocNumberByPrefix(prefix, repCode, seq);
  }

  int used(String prefix, String repCode) =>
      ranges[keyOf(prefix, repCode)]?.used ?? 0;

  String toJson() => jsonEncode(ranges.map((k, v) => MapEntry(k, v.toJson())));

  static NumberingState fromJson(String? raw) {
    final state = NumberingState();
    if (raw == null || raw.trim().isEmpty) return state;
    final map = (jsonDecode(raw) as Map).cast<String, dynamic>();
    map.forEach((k, v) {
      state.ranges[k] = NumberingRange.fromJson((v as Map).cast<String, dynamic>());
    });
    return state;
  }
}

/// تخزين دائم لحالة الترقيم في SharedPreferences.
class NumberingStore {
  static const _kNumbering = 'numbering_state';

  final SharedPreferences _prefs;
  final NumberingState state;

  NumberingStore(this._prefs) : state = NumberingState.fromJson(_prefs.getString(_kNumbering));

  Future<void> applyBlocks(Iterable<api.NumberBlock> blocks) async {
    state.applyBlocks(blocks);
    await _persist();
  }

  Future<String?> next(String prefix, String repCode) async {
    final n = state.next(prefix, repCode);
    if (n != null) await _persist();
    return n;
  }

  Future<void> _persist() => _prefs.setString(_kNumbering, state.toJson());
}