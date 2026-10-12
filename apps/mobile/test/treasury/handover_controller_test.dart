import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/treasury/handover_controller.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;
  late List<http.Request> log;
  late Map<String, bool> flags;

  MockClient buildMock() => MockClient((request) async {
        log.add(request);
        if (request.method == 'POST' && request.url.path == '/treasury/handovers') {
          if (flags['fail'] == true) {
            return _json({'message': 'المبلغ غير صالح'}, 400);
          }
          final body = (jsonDecode(request.body) as Map).cast<String, dynamic>();
          return _json({
            'id': 5,
            'number': 'CH-1',
            'repId': body['repId'],
            'amount': (body['amount'] as num).toStringAsFixed(2),
            'date': body['date'],
            'receivedById': 9,
            'cashAccountId': body['cashAccountId'],
            'notes': body['notes'],
            'status': 'PENDING',
          }, 201);
        }
        return _json({'message': 'not found'}, 404);
      });

  Future<void> setUpContainer({bool withUser = true}) async {
    log = [];
    flags = {};
    SharedPreferences.setMockInitialValues(
      withUser ? {'auth_token': 'tok'} : {},
    );
    FlutterSecureStorage.setMockInitialValues({});
    final session = SessionStore(await SharedPreferences.getInstance());
    if (withUser) {
      await session.saveAuth(
        'tok',
        const AuthUser(
          id: 42,
          name: 'مندوب',
          roleCode: 'SALES_REP',
          permissions: ['cash.handover'],
        ),
      );
    }
    container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(session),
        apiClientProvider.overrideWithValue(
          ApiClient(baseUrl: 'http://test', client: buildMock()),
        ),
      ],
    );
    addTearDown(container.dispose);
  }

  Map<String, dynamic> bodyOf(http.Request r) =>
      (jsonDecode(r.body) as Map).cast<String, dynamic>();

  Iterable<http.Request> byPath(String path) =>
      log.where((r) => r.url.path == path);

  group('HandoverController', () {
    test('إرسال التسليم يرسل المندوب والمبلغ ويبني المحضر', () async {
      await setUpContainer();
      final controller = container.read(handoverControllerProvider.notifier);

      final handover = await controller.submit(amount: 1500, notes: '  عهدة اليوم  ');

      expect(handover, isNotNull);
      expect(handover!.number, 'CH-1');
      expect(handover.amount, 1500);
      final state = container.read(handoverControllerProvider);
      expect(state.submitting, isFalse);
      expect(state.done, isTrue);
      expect(state.error, isNull);
      final sent = byPath('/treasury/handovers').single;
      expect(bodyOf(sent)['repId'], 42);
      expect(bodyOf(sent)['amount'], 1500);
      expect(bodyOf(sent)['notes'], 'عهدة اليوم');
      expect(bodyOf(sent)['date'], isNotNull);
    });

    test('ملاحظات فارغة لا تُرسل في الحمولة', () async {
      await setUpContainer();
      final controller = container.read(handoverControllerProvider.notifier);

      await controller.submit(amount: 100, notes: '   ');

      final sent = byPath('/treasury/handovers').single;
      expect(bodyOf(sent).containsKey('notes'), isFalse);
    });

    test('فشل الخادم يُظهر الخطأ ولا يبني محضراً', () async {
      await setUpContainer();
      flags['fail'] = true;
      final controller = container.read(handoverControllerProvider.notifier);

      final handover = await controller.submit(amount: 200);

      expect(handover, isNull);
      final state = container.read(handoverControllerProvider);
      expect(state.error, 'المبلغ غير صالح');
      expect(state.result, isNull);
    });

    test('مبلغ غير صالح لا يُرسل شيئاً', () async {
      await setUpContainer();
      final controller = container.read(handoverControllerProvider.notifier);

      final handover = await controller.submit(amount: 0);

      expect(handover, isNull);
      expect(container.read(handoverControllerProvider).error, isNotNull);
      expect(byPath('/treasury/handovers'), isEmpty);
    });

    test('بلا مستخدم مسجّل لا يُرسل شيئاً', () async {
      await setUpContainer(withUser: false);
      final controller = container.read(handoverControllerProvider.notifier);

      final handover = await controller.submit(amount: 100);

      expect(handover, isNull);
      expect(container.read(handoverControllerProvider).error, isNotNull);
      expect(byPath('/treasury/handovers'), isEmpty);
    });

    test('reset يمسح الحالة السابقة', () async {
      await setUpContainer();
      final controller = container.read(handoverControllerProvider.notifier);
      await controller.submit(amount: 100);

      controller.reset();

      final state = container.read(handoverControllerProvider);
      expect(state.result, isNull);
      expect(state.error, isNull);
      expect(state.done, isFalse);
    });
  });

  group('todayCashCollected', () {
    final now = DateTime(2026, 10, 10, 14);

    OutboxItem receipt(double amount, {String method = 'CASH', DateTime? at}) => OutboxItem(
          clientUuid: 'r${amount}_$method',
          type: 'receipt',
          payload: {
            'amount': amount,
            'method': method,
            'receivedAt': (at ?? now).toIso8601String(),
          },
          createdAt: at ?? now,
        );

    test('يجمع القبض النقدي لليوم فقط', () {
      final total = todayCashCollected(
        [
          receipt(100),
          receipt(50, method: 'CHEQUE'),
          receipt(25),
          receipt(999, at: DateTime(2026, 10, 9)),
          OutboxItem(
            clientUuid: 'x',
            type: 'return_statement',
            payload: const {'amount': 500},
            createdAt: now,
          ),
        ],
        now,
      );

      expect(total, 125);
    });

    test('بلا قبض نقدي يعيد صفراً', () {
      expect(todayCashCollected(const [], now), 0);
    });
  });
}
