import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/connectivity.dart';
import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/numbering_store.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/sync/sync_controller.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

/// مخزن بيانات زائف — يتيح اختبار المزامنة بمعزل عن Drift/SQLite.
class _FakeDataStore implements DataStore {
  List<ItemSummary> _items = const [];
  List<CustomerSummary> _customers = const [];
  List<PriceListSummary> _priceLists = const [];
  List<StatementSummary> _statements = const [];
  final Map<int, double> _stock = {};
  DateTime? _lastDelta;
  final Map<String, String> _meta = {};

  int saveItemsCalls = 0;
  DateTime? savedDelta;

  @override
  List<ItemSummary> get items => _items;
  @override
  List<CustomerSummary> get customers => _customers;
  @override
  List<PriceListSummary> get priceLists => _priceLists;
  @override
  List<StatementSummary> get statements => _statements;
  @override
  Map<int, double> get stock => _stock;
  @override
  DateTime? get lastDelta => _lastDelta;

  @override
  double stockQty(int itemId) => _stock[itemId] ?? 0;

  @override
  Future<void> init() async {}

  @override
  double? priceForCustomer(int customerId, int itemId, {int? unitId}) => null;

  @override
  Future<void> saveItems(List<ItemSummary> v) async {
    saveItemsCalls++;
    _items = [..._items, ...v];
  }

  @override
  Future<void> saveCustomers(List<CustomerSummary> v) async => _customers = v;
  @override
  Future<void> savePriceLists(List<PriceListSummary> v) async => _priceLists = v;
  @override
  Future<void> saveStatements(List<StatementSummary> v) async => _statements = v;

  @override
  Future<void> saveStock(List<ItemStock> v) async {
    for (final s in v) {
      _stock[s.itemId] = s.qty;
    }
  }

  @override
  Future<void> saveLastDelta(DateTime at) async {
    _lastDelta = at;
    savedDelta = at;
  }

  @override
  Future<String?> readMeta(String key) async => _meta[key];

  @override
  Future<void> writeMeta(String key, String value) async => _meta[key] = value;

  @override
  Future<void> close() async {}
}

class _FakeConnectivity implements ConnectivityStatus {
  final _controller = StreamController<bool>.broadcast();
  bool online = true;

  @override
  Future<bool> isOnline() async => online;

  @override
  Stream<bool> get onChanged => _controller.stream;

  void emit(bool value) {
    online = value;
    _controller.add(value);
  }

  void close() => _controller.close();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;
  late Outbox outbox;
  late _FakeDataStore store;
  late _FakeConnectivity connectivity;
  late List<http.Request> log;
  // يحاكي خادماً قديماً بلا قسم stock (R3-F2).
  bool omitStock = false;

  MockClient buildMock() => MockClient((request) async {
        log.add(request);
        final path = request.url.path;
        if (request.method == 'POST' && path == '/sync/push') {
          final body = (jsonDecode(request.body) as Map).cast<String, dynamic>();
          final items = (body['items'] as List).cast<Map>();
          final results = items.map((it) {
            final payload = ((it['payload'] as Map?) ?? const {}).cast<String, dynamic>();
            if (payload['force_review'] == true) {
              return {
                'clientUuid': it['clientUuid'],
                'status': 'PENDING_REVIEW',
                'serverId': 100,
                'number': 'BP-M03-000100',
              };
            }
            if (payload['force_fail'] == true) {
              return {
                'clientUuid': it['clientUuid'],
                'status': 'LOCAL',
                'error': 'net_mismatch',
              };
            }
            if (payload['force_alerts'] == true) {
              return {
                'clientUuid': it['clientUuid'],
                'status': 'APPROVED',
                'serverId': 2,
                'number': 'BP-M03-000002',
                'pricingAlerts': [
                  {
                    'type': 'below_cost',
                    'itemCode': 'IR',
                    'unitPrice': 50,
                    'threshold': 40,
                  },
                ],
              };
            }
            return {
              'clientUuid': it['clientUuid'],
              'status': 'APPROVED',
              'serverId': 1,
              'number': 'BP-M03-000001',
            };
          }).toList();
          return _json({'results': results});
        }
        if (request.method == 'GET' && path == '/sync/delta') {
          return _json({
            'serverTime': '2026-10-11T12:00:00.000Z',
            'items': [],
            'customers': [],
            'priceLists': [],
            'statements': [],
            'blocks': [],
            if (!omitStock)
              'stock': [
                {'itemId': 42, 'qty': 7.5},
                {'itemId': 43, 'qty': 0},
              ],
          });
        }
        return _json({'message': 'not found'}, 404);
      });

  Future<void> setUpContainer({BackoffPolicy? policy}) async {
    log = [];
    omitStock = false;
    outbox = Outbox(policy: policy ?? const BackoffPolicy());
    store = _FakeDataStore();
    connectivity = _FakeConnectivity();
    SharedPreferences.setMockInitialValues({
      'device_id': 'test-device',
      'auth_token': 'tok',
    });
    final prefs = await SharedPreferences.getInstance();
    container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(SessionStore(prefs)),
        dataStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(
          ApiClient(baseUrl: 'http://test', client: buildMock()),
        ),
        outboxProvider.overrideWithValue(outbox),
        numberingProvider.overrideWithValue(NumberingStore(prefs)),
        connectivityProvider.overrideWithValue(connectivity),
      ],
    );
    addTearDown(() {
      container.dispose();
      connectivity.close();
    });
  }

  Future<void> waitUntil(bool Function() ok, {int timeoutMs = 3000}) async {
    final end = DateTime.now().add(Duration(milliseconds: timeoutMs));
    while (!ok()) {
      if (DateTime.now().isAfter(end)) fail('انقضت المهلة دون بلوغ الحالة المطلوبة');
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  SyncController controller() => container.read(syncControllerProvider.notifier);
  SyncState state() => container.read(syncControllerProvider);

  group('SyncController', () {
    test('يرفع العناصر المعلّقة ويعتمدها ويحدّث المؤشّرات', () async {
      await setUpContainer();
      controller();
      controller().enqueue(type: 'price_statement', payload: const {});
      controller().enqueue(type: 'receipt', payload: const {});
      expect(state().pending, 2);

      await controller().syncNow();

      expect(outbox.all.every((i) => i.status == SyncStatus.approved), isTrue);
      expect(state().pending, 0);
      expect(state().error, isNull);
      expect(state().lastSyncAt, isNotNull);
      expect(store.savedDelta, isNotNull, reason: 'حُدّث مؤشّر المزامنة');
    });

    test('يصنّف نتيجة PENDING_REVIEW ويعدّها للمراجعة', () async {
      await setUpContainer();
      controller();
      controller().enqueue(
        type: 'price_statement',
        payload: const {'force_review': true},
      );

      await controller().syncNow();

      expect(outbox.pendingReviewCount, 1);
      expect(state().pendingReview, 1);
      expect(state().pending, 0);
      expect(outbox.all.single.status, SyncStatus.pendingReview);
    });

    test('فشل الرفع يزيد المحاولات ويظهر في الحالة', () async {
      await setUpContainer();
      controller();
      controller().enqueue(
        type: 'price_statement',
        payload: const {'force_fail': true},
      );

      await controller().syncNow();

      expect(outbox.all.single.attempts, 1);
      expect(state().failed, 1);
      expect(state().blocked, isFalse);
      expect(outbox.all.single.lastError, 'net_mismatch');
    });

    test('بلوغ الحد الأقصى للمحاولات يظهر كحالة «متوقفة»', () async {
      await setUpContainer(policy: const BackoffPolicy(maxAttempts: 1));
      controller();
      controller().enqueue(
        type: 'price_statement',
        payload: const {'force_fail': true},
      );

      await controller().syncNow();

      expect(outbox.hasReachedMaxAttempts, isTrue);
      expect(state().blocked, isTrue);
    });

    test('retryFailed يعيد الضبط ثم يرفع بنجاح', () async {
      await setUpContainer();
      controller();
      controller().enqueue(
        type: 'price_statement',
        payload: <String, dynamic>{'force_fail': true},
      );
      await controller().syncNow();
      expect(state().failed, 1);

      // بدّل الاستجابة إلى نجاح عبر إفراغ بيانات الفشل.
      outbox.all.single.payload.clear();

      await controller().retryFailed();

      expect(outbox.all.single.attempts, 0);
      expect(state().failed, 0);
      expect(outbox.all.single.status, SyncStatus.approved);
    });

    test('المزامنة التلقائية تنطلق عند عودة الاتصال مع وجود معلّقات', () async {
      await setUpContainer();
      controller();
      controller().enqueue(type: 'price_statement', payload: const {});

      connectivity.emit(true);

      await waitUntil(() => log.any((r) => r.url.path == '/sync/push'));
      await waitUntil(() => state().pending == 0);
      expect(outbox.all.single.status, SyncStatus.approved);
    });

    test('لا مزامنة تلقائية دون عناصر معلّقة', () async {
      await setUpContainer();
      controller();

      connectivity.emit(true);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(log.any((r) => r.url.path == '/sync/push'), isFalse);
    });

    test('يجمع تنبيهات التسعير المعادة من الخادم (R3-A8)', () async {
      await setUpContainer();
      controller();
      controller().enqueue(
        type: 'price_statement',
        payload: const {'force_alerts': true},
      );

      await controller().syncNow();

      final alerts = state().pricingAlerts;
      expect(alerts, hasLength(1));
      expect(alerts.single.type, 'below_cost');
      expect(alerts.single.itemCode, 'IR');
      expect(alerts.single.unitPrice, 50);
      expect(alerts.single.threshold, 40);
    });

    test('لا تنبيهات تُجمع حين لا يُعيدها الخادم', () async {
      await setUpContainer();
      controller();
      controller().enqueue(type: 'price_statement', payload: const {});

      await controller().syncNow();

      expect(state().pricingAlerts, isEmpty);
    });

    test('يحفظ قسم stock الوارد من الخادم في المخزن (R3-F2)', () async {
      await setUpContainer();
      controller();

      await controller().syncNow();

      expect(store.stockQty(42), 7.5);
      expect(store.stockQty(43), 0);
      expect(store.stockQty(999), 0, reason: 'صنف بلا رصيد = صفر');
    });

    test('استجابة بلا قسم stock (خادم قديم) لا تمسّ الأرصدة المخزنة', () async {
      await setUpContainer();
      controller();
      await controller().syncNow();
      expect(store.stockQty(42), 7.5);

      await store.saveStock(const [ItemStock(itemId: 42, qty: 99)]);
      omitStock = true;

      await controller().syncNow();
      expect(store.stockQty(42), 99, reason: 'غياب القسم لا يصفّر ما هو مخزّن');
    });
  });
}
