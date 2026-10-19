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
import 'package:bayan_rep/features/stocktake/stocktake_controller.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

class _FakeDataStore implements DataStore {
  final Map<String, String> meta = {};

  @override
  List<ItemSummary> get items => const [];
  @override
  List<CustomerSummary> get customers => const [];
  @override
  List<PriceListSummary> get priceLists => const [];
  @override
  List<StatementSummary> get statements => const [];
  @override
  DateTime? get lastDelta => null;
  @override
  double stockQty(int itemId) => 0;
  @override
  Map<int, double> get stock => const {};

  @override
  Future<void> init() async {}
  @override
  double? priceForCustomer(int customerId, int itemId, {int? unitId}) => null;

  @override
  Future<void> saveItems(List<ItemSummary> v) async {}
  @override
  Future<void> saveCustomers(List<CustomerSummary> v) async {}
  @override
  Future<void> savePriceLists(List<PriceListSummary> v) async {}
  @override
  Future<void> saveStatements(List<StatementSummary> v) async {}
  @override
  Future<void> saveStock(List<ItemStock> v) async {}
  @override
  Future<void> saveLastDelta(DateTime at) async {}
  @override
  Future<void> close() async {}

  @override
  Future<String?> readMeta(String key) async => meta[key];
  @override
  Future<void> writeMeta(String key, String value) async => meta[key] = value;
}

class _FakeConnectivity implements ConnectivityStatus {
  final _controller = StreamController<bool>.broadcast();
  @override
  Future<bool> isOnline() async => true;
  @override
  Stream<bool> get onChanged => _controller.stream;
  void close() => _controller.close();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;
  late Outbox outbox;
  late _FakeDataStore store;
  late _FakeConnectivity connectivity;
  late List<http.Request> log;
  late Map<String, bool> flags;

  Map<String, dynamic> listBody() => {
        'total': 1,
        'items': [
          {
            'id': 3,
            'number': 'ST-1',
            'status': 'COUNTING',
            'warehouse': {'id': 1, 'code': 'W1', 'nameAr': 'المخزن الرئيسي'},
            'openedAt': '2026-10-15T08:00:00.000Z',
            '_count': {'lines': 2},
          },
        ],
      };

  Map<String, dynamic> detailBody() => {
        'id': 3,
        'number': 'ST-1',
        'status': flags['review'] == true ? 'REVIEW' : 'COUNTING',
        'warehouse': {'id': 1, 'code': 'W1', 'nameAr': 'المخزن الرئيسي'},
        'lines': [
          {
            'itemId': 11,
            'batchId': '',
            'systemQtyBase': '5',
            'countedQtyBase': null,
            'lastCost': '1000',
            'item': {'id': 11, 'code': 'IR-16-10', 'nameAr': 'صنف أول', 'trackBatch': false},
          },
          {
            'itemId': 12,
            'batchId': 'B1',
            'systemQtyBase': 2,
            'countedQtyBase': '2',
            'lastCost': null,
            'item': {'id': 12, 'code': 'PT-20-02', 'nameAr': 'صنف ثانٍ', 'trackBatch': true},
          },
        ],
      };

  MockClient buildMock() => MockClient((request) async {
        log.add(request);
        final path = request.url.path;
        if (request.method == 'GET' && path == '/stocktakes') {
          if (flags['listFail'] == true) return _json({'message': 'boom'}, 500);
          return _json(listBody());
        }
        if (request.method == 'GET' && path == '/stocktakes/3') {
          return _json(detailBody());
        }
        if (request.method == 'POST' && path == '/sync/push') {
          final body = (jsonDecode(request.body) as Map).cast<String, dynamic>();
          final items = (body['items'] as List).cast<Map>();
          final results = items.map((it) {
            if (flags['offline'] == true) {
              return {'clientUuid': it['clientUuid'], 'status': 'LOCAL', 'error': 'offline'};
            }
            return {'clientUuid': it['clientUuid'], 'status': 'UPLOADED', 'serverId': 3};
          }).toList();
          return _json({'results': results});
        }
        if (request.method == 'GET' && path == '/sync/delta') {
          return _json({
            'serverTime': '2026-10-15T12:00:00.000Z',
            'items': [],
            'customers': [],
            'priceLists': [],
            'statements': [],
            'blocks': [],
          });
        }
        return _json({'message': 'not found'}, 404);
      });

  Future<void> setUpContainer() async {
    log = [];
    flags = {};
    outbox = Outbox();
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

  StocktakeListController list() =>
      container.read(stocktakeListProvider.notifier);
  StocktakeListState listState() => container.read(stocktakeListProvider);
  StocktakeCountController count() =>
      container.read(stocktakeCountProvider.notifier);
  StocktakeCountState countState() => container.read(stocktakeCountProvider);

  group('StocktakeListController', () {
    test('يحمّل الجلسات ويخزّنها مؤقتاً', () async {
      await setUpContainer();
      await list().load();

      final st = listState();
      expect(st.sessions, hasLength(1));
      expect(st.sessions.single.number, 'ST-1');
      expect(st.sessions.single.warehouseName, 'المخزن الرئيسي');
      expect(st.sessions.single.isCountable, isTrue);
      expect(st.loading, isFalse);
      expect(store.meta['stocktake.sessions'], isNotNull);
    });

    test('يعود للذاكرة المؤقتة عند تعذّر الاتصال', () async {
      await setUpContainer();
      await list().load();
      flags['listFail'] = true;

      await list().load();

      final st = listState();
      expect(st.offline, isTrue);
      expect(st.sessions, hasLength(1));
    });
  });

  group('StocktakeCountController', () {
    test('يفتح الجلسة ويحمّل بنودها بأرقام صحيحة', () async {
      await setUpContainer();
      await count().open(3);

      final st = countState();
      expect(st.lines, hasLength(2));
      expect(st.lines.first.systemQty, 5);
      expect(st.lines.first.countedQty, isNull);
      expect(st.lines[1].countedQty, 2);
      expect(st.editable, isTrue);
    });

    test('setCount يحدّث الكميات المدخلة ويعدّ البنود', () async {
      await setUpContainer();
      await count().open(3);
      final first = countState().lines.first;

      count().setCount(first.key, 7);
      count().setCount(countState().lines[1].key, 3);

      final st = countState();
      expect(st.entered[first.key], 7);
      expect(st.countedCount, 2);
    });

    test('save يضع عنصر stocktake واحداً في الصندوق، والحفظ الثاني يدمج', () async {
      await setUpContainer();
      flags['offline'] = true;
      await count().open(3);
      count().setCount(countState().lines.first.key, 7);

      final saved = await count().save();
      expect(saved, 1);
      expect(outbox.all, hasLength(1));
      final item = outbox.all.single;
      expect(item.type, 'stocktake');
      expect(item.payload['sessionId'], 3);
      final counts = (item.payload['counts'] as List).cast<Map>();
      expect(counts.single['itemId'], 11);
      expect(counts.single['batchId'], '');
      expect(counts.single['qty'], 7);

      count().setCount(countState().lines[1].key, 3);
      await count().save();

      expect(outbox.all, hasLength(1), reason: 'دمج بدل تكرار العناصر');
      expect((outbox.all.single.payload['counts'] as List), hasLength(2));
    });

    test('يستعيد الكميات غير المرفوعة عند إعادة فتح الجلسة', () async {
      await setUpContainer();
      flags['offline'] = true;
      await count().open(3);
      final first = countState().lines.first;
      count().setCount(first.key, 9);
      await count().save();

      await count().open(3);

      expect(countState().entered[first.key], 9);
    });

    test('جلسة للمراجعة لا تقبل التعديل', () async {
      await setUpContainer();
      flags['review'] = true;
      await count().open(3);

      expect(countState().editable, isFalse);
      count().setCount(countState().lines.first.key, 5);
      expect(countState().entered, isEmpty);

      final saved = await count().save();
      expect(saved, isNull);
      expect(countState().error, isNotNull);
      expect(outbox.all, isEmpty);
    });
  });
}
