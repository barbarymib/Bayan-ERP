import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'outbox.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// نتيجة رفع عنصر واحد داخل دفعة المزامنة.
class PushResultItem {
  final String clientUuid;
  final SyncStatus status;
  final int? serverId;
  final String? number;
  final String? error;

  const PushResultItem({
    required this.clientUuid,
    required this.status,
    this.serverId,
    this.number,
    this.error,
  });

  factory PushResultItem.fromJson(Map<String, dynamic> j) => PushResultItem(
        clientUuid: j['clientUuid'] as String,
        status: SyncStatus.fromCode(j['status'] as String?),
        serverId: (j['serverId'] as num?)?.toInt(),
        number: j['number'] as String?,
        error: j['error'] as String?,
      );
}

/// عميل واجهة الـ API للموبايل — يطابق عقد المزامنة المخطط في المرحلة 4.
class ApiClient {
  final String baseUrl;
  final http.Client _client;

  /// رمز الوصول الذي يُحقن في ترويسة `Authorization`.
  String? token;

  /// رمز التحديث المستخدم لتجديد رمز الوصول عند انتهائه (401).
  String? refreshToken;

  /// معرّف الجهاز الذي يُرسَل في ترويسة `X-Device-Id` — يفعّل فحص الجهاز
  /// النشط على الخادم (§9/G4). يُضبط من الجلسة عند الإقلاع وبعد تسجيل الجهاز.
  String? deviceId;

  /// يُستدعى بعد التجديد الصامت لحفظ الزوج الجديد في جلسة الجهاز.
  Future<void> Function(String accessToken, String refreshToken)? onRefreshed;

  Future<bool>? _refreshInFlight;

  ApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  Map<String, String> get _headers => {
        'Content-Type': 'application/json; charset=utf-8',
        if ((token ?? '').isNotEmpty) 'Authorization': 'Bearer $token',
        if ((deviceId ?? '').isNotEmpty) 'X-Device-Id': deviceId!,
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Future<http.Response> _exec(Future<http.Response> Function() run) async {
    try {
      return await run();
    } catch (_) {
      throw ApiException(0, 'تعذّر الاتصال بالخادم');
    }
  }

  /// يجدد زوج الرموز مرة واحدة؛ النداءات المتزامنة تتشارك نفس الطلب.
  Future<bool> _tryRefresh() {
    final existing = _refreshInFlight;
    if (existing != null) return existing;
    final future = _doRefresh();
    _refreshInFlight = future.whenComplete(() => _refreshInFlight = null);
    return _refreshInFlight!;
  }

  Future<bool> _doRefresh() async {
    final rt = refreshToken;
    if (rt == null || rt.isEmpty) return false;
    try {
      final res = await _client.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({'refreshToken': rt}),
      );
      if (res.statusCode < 200 || res.statusCode >= 300) return false;
      final decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (decoded is! Map<String, dynamic>) return false;
      final access = decoded['accessToken'] as String?;
      final refresh = decoded['refreshToken'] as String?;
      if (access == null || refresh == null) return false;
      token = access;
      refreshToken = refresh;
      await onRefreshed?.call(access, refresh);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _send(
    Future<http.Response> Function() run,
    String fallback,
  ) async {
    var res = await _exec(run);
    if (res.statusCode == 401 && (refreshToken ?? '').isNotEmpty) {
      if (await _tryRefresh()) {
        res = await _exec(run);
      }
    }
    Map<String, dynamic>? json;
    if (res.bodyBytes.isNotEmpty) {
      try {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        if (decoded is Map<String, dynamic>) json = decoded;
      } catch (_) {}
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, (json?['message'] ?? fallback).toString());
    }
    return json ?? <String, dynamic>{};
  }

  Future<AuthUser> login({String? phone, String? email, required String password}) async {
    final json = await _send(
      () => _client.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({'phone': phone, 'email': email, 'password': password}),
      ),
      'فشل تسجيل الدخول',
    );
    token = json['accessToken'] as String;
    refreshToken = json['refreshToken'] as String?;
    return AuthUser.fromJson((json['user'] as Map).cast<String, dynamic>());
  }

  Future<void> registerDevice({required String deviceId, String? deviceName}) async {
    await _send(
      () => _client.post(
        _uri('/sync/device/register'),
        headers: _headers,
        body: jsonEncode({'deviceId': deviceId, 'deviceName': deviceName}),
      ),
      'فشل تسجيل الجهاز',
    );
  }

  Future<DeltaPayload> delta({DateTime? since}) async {
    final json = await _send(
      () => _client.get(
        _uri('/sync/delta', since == null ? null : {'since': since.toIso8601String()}),
        headers: _headers,
      ),
      'فشل المزامنة التفاضلية',
    );
    return DeltaPayload(
      serverTime: DateTime.parse(
        (json['serverTime'] as String?) ?? DateTime.now().toIso8601String(),
      ),
      items: ((json['items'] as List?) ?? const [])
          .map((e) => ItemSummary.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      customers: ((json['customers'] as List?) ?? const [])
          .map((e) => CustomerSummary.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      blocks: ((json['blocks'] as List?) ?? const [])
          .map((e) => NumberBlock.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      priceLists: ((json['priceLists'] as List?) ?? const [])
          .map((e) => PriceListSummary.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      statements: ((json['statements'] as List?) ?? const [])
          .map((e) => StatementSummary.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }

  Future<List<PushResultItem>> push(List<OutboxItem> items) async {
    final json = await _send(
      () => _client.post(
        _uri('/sync/push'),
        headers: _headers,
        body: jsonEncode({
          'items': items
              .map((i) => {
                    'clientUuid': i.clientUuid,
                    'type': i.type,
                    'payload': i.payload,
                    'number': i.number,
                  })
              .toList(),
        }),
      ),
      'فشل رفع البيانات',
    );
    return ((json['results'] as List?) ?? const [])
        .map((e) => PushResultItem.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<NumberBlock> reserveBlock({
    required String kind,
    required String repCode,
    int count = 100,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/sync/blocks'),
        headers: _headers,
        body: jsonEncode({'kind': kind, 'repCode': repCode, 'count': count}),
      ),
      'فشل حجز الأرقام',
    );
    return NumberBlock.fromJson(json);
  }

  /// يبدأ وردية تتبع الموقع (يُرجع الوردية النشطة إن وُجدت).
  Future<ActiveShift> startShift({double? lat, double? lng, String? deviceId}) async {
    final json = await _send(
      () => _client.post(
        _uri('/geo/shifts/start'),
        headers: _headers,
        body: jsonEncode({'lat': lat, 'lng': lng, 'deviceId': deviceId}),
      ),
      'فشل بدء الوردية',
    );
    return ActiveShift.fromJson(json);
  }

  /// الوردية النشطة حالياً (أو null إن لم توجد).
  Future<ActiveShift?> currentShift() async {
    final json = await _send(
      () => _client.get(_uri('/geo/shifts/current'), headers: _headers),
      'فشل جلب الوردية',
    );
    if (!json.containsKey('id')) return null;
    return ActiveShift.fromJson(json);
  }

  Future<ActiveShift> endShift({int? shiftId, double? lat, double? lng}) async {
    final json = await _send(
      () => _client.post(
        _uri('/geo/shifts/end'),
        headers: _headers,
        body: jsonEncode({'shiftId': shiftId, 'lat': lat, 'lng': lng}),
      ),
      'فشل إنهاء الوردية',
    );
    return ActiveShift.fromJson(json);
  }

  /// يرسل نقطة موقع أثناء الوردية (يُرفض الطلب خارج وردية نشطة).
  Future<void> pushLocation({
    required double lat,
    required double lng,
    double? accuracy,
    DateTime? capturedAt,
  }) async {
    await _send(
      () => _client.post(
        _uri('/geo/locations'),
        headers: _headers,
        body: jsonEncode({
          'lat': lat,
          'lng': lng,
          'accuracy': accuracy,
          'capturedAt': (capturedAt ?? DateTime.now()).toUtc().toIso8601String(),
        }),
      ),
      'فشل إرسال الموقع',
    );
  }

  /// يسجّل زيارة عميل — الخادم يفحص القرب من العميل (الحد 150م).
  Future<VisitResult> recordVisit({
    required int customerId,
    required String status,
    String? reason,
    double? lat,
    double? lng,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/geo/visits'),
        headers: _headers,
        body: jsonEncode({
          'customerId': customerId,
          'status': status,
          'reason': reason,
          'lat': lat,
          'lng': lng,
        }),
      ),
      'فشل تسجيل الزيارة',
    );
    return VisitResult.fromJson(json);
  }

  /// خطة زيارات اليوم للمندوب الحالي (§5.12) — بلا خطة تُرجع خطة فارغة.
  Future<VisitPlan> todayVisitPlan() async {
    final json = await _send(
      () => _client.get(_uri('/visits/plans/today'), headers: _headers),
      'فشل جلب خطة الزيارات',
    );
    return VisitPlan.fromJson(json);
  }

  /// يحدّث حالة بند في خطة الزيارات (PLANNED/DONE/MISSED) ويُرجع الخطة كاملة.
  Future<VisitPlan> setVisitPlanLineStatus({
    required int planId,
    required int lineId,
    required String status,
    String? notes,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/visits/plans/$planId/lines/$lineId/status'),
        headers: _headers,
        body: jsonEncode({'status': status, 'notes': notes}),
      ),
      'فشل تحديث حالة الزيارة',
    );
    return VisitPlan.fromJson(json);
  }

  /// يسجّل محضر تسليم عهدة نقدية من المندوب للخزينة (§5.10).
  Future<CustodyHandover> createHandover({
    required int repId,
    required double amount,
    DateTime? date,
    int? cashAccountId,
    String? notes,
  }) async {
    final trimmed = notes?.trim() ?? '';
    final json = await _send(
      () => _client.post(
        _uri('/treasury/handovers'),
        headers: _headers,
        body: jsonEncode({
          'repId': repId,
          'amount': amount,
          'date': (date ?? DateTime.now()).toIso8601String(),
          'cashAccountId': ?cashAccountId,
          if (trimmed.isNotEmpty) 'notes': trimmed,
        }),
      ),
      'فشل تسجيل تسليم العهدة',
    );
    return CustodyHandover.fromJson(json);
  }
}