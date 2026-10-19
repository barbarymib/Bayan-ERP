import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/home/today_kpis_controller.dart';
import 'package:bayan_rep/features/home/today_kpis_view.dart';

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

Map<String, dynamic> _row({int repId = 7}) => {
      'repId': repId,
      'repCode': 'R1',
      'name': 'مندوب',
      'targetAmount': 1000,
      'salesNet': 250.5,
      'salesCount': 3,
      'collected': 100,
      'collectionRatePct': 39.9,
      'visits': 5,
      'visitsDone': 2,
      'visitsMissed': 1,
      'distanceKm': 12.34,
      'achievementPct': 25,
    };

Map<String, dynamic> _payload({int repId = 7, String? day}) => {
      'from': day ?? '2026-10-19',
      'to': day ?? '2026-10-19',
      'rows': [_row(repId: repId)],
      'totals': {'reps': 1},
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('todayKpisView (نقية)', () {
    test('dayFilter يصيغ yyyy-MM-dd بصفر مقدّم', () {
      expect(dayFilter(DateTime(2026, 10, 5)), '2026-10-05');
      expect(dayFilter(DateTime(2026, 10, 19)), '2026-10-19');
    });

    test('isForToday يقبل فترة اليوم ويرفض فترة يوم آخر', () {
      final now = DateTime(2026, 10, 19, 15);
      final today = TodayKpis.fromResponse(_payload(day: '2026-10-19'), fallbackDate: now);
      final other = TodayKpis.fromResponse(_payload(day: '2026-10-18'), fallbackDate: now);
      expect(isForToday(today, now: now), isTrue);
      expect(isForToday(other, now: now), isFalse);
    });

    test('todayKpiCards تبني كل البطاقات بالقيم المنسّقة', () {
      final k = TodayKpis.fromResponse(_payload(), fallbackDate: DateTime(2026, 10, 19));
      final cards = todayKpiCards(k);
      expect(cards, hasLength(5)); // هدف > 0 ⇒ بطاقة نسبة التحقيق
      expect(cards[0].label, 'مبيعات اليوم');
      expect(cards[0].value, '250.50');
      expect(cards[0].caption, '3 بيان');
      expect(cards[0].highlight, isTrue);
      expect(cards[1].value, '100.00');
      expect(cards[1].caption, 'نسبة التحصيل 40%');
      expect(cards[2].value, '2 / 5');
      expect(cards[2].caption, '1 فائتة');
      expect(cards[3].value, '12.3 كم');
      expect(cards[4].label, 'نسبة تحقيق الهدف');
      expect(cards[4].value, '25%');
    });

    test('بدون هدف لا تُنشأ بطاقة نسبة التحقيق', () {
      final j = _payload();
      (j['rows'] as List).first['targetAmount'] = 0;
      final k = TodayKpis.fromResponse(j, fallbackDate: DateTime(2026, 10, 19));
      final cards = todayKpiCards(k);
      expect(cards, hasLength(4));
      expect(cards.any((c) => c.label == 'نسبة تحقيق الهدف'), isFalse);
    });

    test('TodayKpis.fromResponse يختار صف المندوب بين صفوف متعددة', () {
      final j = _payload();
      (j['rows'] as List).add({'repId': 99, 'salesNet': 999});
      final k = TodayKpis.fromResponse(j, repId: 7, fallbackDate: DateTime(2026, 10, 19));
      expect(k.salesNet, 250.5);
      final other = TodayKpis.fromResponse(j, repId: 99, fallbackDate: DateTime(2026, 10, 19));
      expect(other.salesNet, 999);
    });

    test('استجابة صفوف فارغة ⇒ مؤشرات صفريّة', () {
      final k = TodayKpis.fromResponse(
        {'from': '2026-10-19', 'to': '2026-10-19', 'rows': []},
        repId: 7,
        fallbackDate: DateTime(2026, 10, 19),
      );
      expect(k.salesNet, 0);
      expect(k.salesCount, 0);
      expect(todayKpiCards(k).first.value, '0.00');
    });
  });

  group('TodayKpisController', () {
    late ProviderContainer container;
    late _FakeDataStore store;
    late List<http.Request> log;
    late Map<String, bool> flags;

    MockClient buildMock() => MockClient((request) async {
          log.add(request);
          if (request.method == 'GET' && request.url.path == '/reports/rep-performance') {
            if (flags['fail'] == true) return _json({'message': 'boom'}, 500);
            return _json(_payload(
              repId: int.parse(request.url.queryParameters['repId'] ?? '0'),
              day: request.url.queryParameters['from'],
            ));
          }
          return _json({'message': 'not found'}, 404);
        });

    Future<void> setUpContainer() async {
      log = [];
      flags = {};
      store = _FakeDataStore();
      SharedPreferences.setMockInitialValues({
        'auth_token': 'tok',
        'auth_user': jsonEncode({
          'id': 7,
          'name': 'مندوب',
          'phone': '0100',
          'repCode': 'R1',
          'permissions': <String>[],
        }),
      });
      final prefs = await SharedPreferences.getInstance();
      container = ProviderContainer(
        overrides: [
          sessionProvider.overrideWithValue(SessionStore(prefs)),
          dataStoreProvider.overrideWithValue(store),
          apiClientProvider.overrideWithValue(
            ApiClient(baseUrl: 'http://test', client: buildMock()),
          ),
        ],
      );
      addTearDown(container.dispose);
    }

    TodayKpisState state() => container.read(todayKpisControllerProvider);
    TodayKpisController ctrl() => container.read(todayKpisControllerProvider.notifier);

    test('يجلب مؤشرات اليوم بمرشّح repId ومن/إلى بتاريخ اليوم', () async {
      await setUpContainer();
      await ctrl().refresh();

      final st = state();
      expect(st.error, isNull);
      expect(st.offline, isFalse);
      expect(st.kpis, isNotNull);
      expect(st.kpis!.salesNet, 250.5);
      expect(st.kpis!.salesCount, 3);

      final req = log.singleWhere((r) => r.url.path == '/reports/rep-performance');
      expect(req.url.queryParameters['repId'], '7');
      expect(req.url.queryParameters['from'], dayFilter(DateTime.now()));
      expect(req.url.queryParameters['to'], dayFilter(DateTime.now()));
      expect(store.meta['home.today_kpis'], isNotNull);
    });

    test('يعرض كاش اليوم عند الفشل (أوفلاين)', () async {
      await setUpContainer();
      await ctrl().refresh();
      flags['fail'] = true;

      await ctrl().refresh();

      final st = state();
      expect(st.kpis, isNotNull);
      expect(st.offline, isTrue);
      expect(st.error, isNull);
      expect(st.kpis!.salesNet, 250.5);
    });

    test('يتجاهل كاش يومٍ آخر ويعرض الخطأ', () async {
      await setUpContainer();
      await ctrl().refresh();
      // أفسد الكاش ليبدو من يوم سابق.
      final envelope =
          (jsonDecode(store.meta['home.today_kpis']!) as Map).cast<String, dynamic>();
      envelope['day'] = '2020-01-01';
      store.meta['home.today_kpis'] = jsonEncode(envelope);
      flags['fail'] = true;

      await ctrl().refresh();

      final st = state();
      expect(st.kpis, isNull);
      expect(st.offline, isFalse);
      expect(st.error, isNotNull);
    });

    test('فشل بلا كاش ⇒ خطأ دون مؤشرات', () async {
      await setUpContainer();
      flags['fail'] = true;

      await ctrl().refresh();

      final st = state();
      expect(st.kpis, isNull);
      expect(st.error, 'boom');
      expect(st.loading, isFalse);
    });

    test('clearError يمحو الخطأ ويُبقي المؤشرات', () async {
      await setUpContainer();
      flags['fail'] = true;
      await ctrl().refresh();
      expect(state().error, isNotNull);

      ctrl().clearError();
      expect(state().error, isNull);
    });
  });
}
