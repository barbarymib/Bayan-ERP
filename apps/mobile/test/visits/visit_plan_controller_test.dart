import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:bayan_rep/core/api_client.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/features/visits/visit_plan_controller.dart';

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Map<String, dynamic> _line(int id, String status, {String? notes}) => {
      'id': id,
      'planId': 7,
      'customerId': id,
      'sequence': id,
      'status': status,
      'notes': notes,
      'customer': {
        'id': id,
        'code': 'C$id',
        'nameAr': 'عميل $id',
        'phone': '0$id',
        'lat': 31.2,
        'lng': 35.1,
      },
    };

Map<String, dynamic> _plan(List<Map<String, dynamic>> lines) => {
      'id': 7,
      'date': '2026-10-10T00:00:00.000Z',
      'notes': null,
      'lines': lines,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;
  late List<http.Request> log;
  late Map<String, bool> flags;

  MockClient buildMock() => MockClient((request) async {
        log.add(request);
        final path = request.url.path;
        final method = request.method;

        if (method == 'GET' && path == '/visits/plans/today') {
          if (flags['fail'] == true) return _json({'message': 'خطأ من الخادم'}, 500);
          if (flags['empty'] == true) {
            return _json({'date': '2026-10-10T00:00:00.000Z', 'lines': []});
          }
          return _json(_plan([_line(1, 'PLANNED'), _line(2, 'DONE')]));
        }
        final statusMatch =
            RegExp(r'^/visits/plans/(\d+)/lines/(\d+)/status$').firstMatch(path);
        if (method == 'POST' && statusMatch != null) {
          final lineId = int.parse(statusMatch.group(2)!);
          final body = (jsonDecode(request.body) as Map).cast<String, dynamic>();
          return _json(_plan([
            _line(lineId, body['status'] as String, notes: body['notes'] as String?),
            _line(2, 'DONE'),
          ]));
        }
        return _json({'message': 'not found'}, 404);
      });

  Future<void> setUpContainer() async {
    log = [];
    flags = {};
    container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(
          ApiClient(baseUrl: 'http://test', client: buildMock()),
        ),
      ],
    );
    addTearDown(container.dispose);
  }

  Map<String, dynamic> bodyOf(http.Request r) =>
      (jsonDecode(r.body) as Map).cast<String, dynamic>();

  Iterable<http.Request> byPath(String segment) =>
      log.where((r) => r.url.path.contains(segment));

  group('VisitPlanController', () {
    test('تحميل خطة اليوم يبني البنود وحالة كل عميل', () async {
      await setUpContainer();
      final controller = container.read(visitPlanControllerProvider.notifier);

      await controller.refresh();

      final state = container.read(visitPlanControllerProvider);
      expect(state.loading, isFalse);
      expect(state.plan, isNotNull);
      expect(state.hasPlan, isTrue);
      expect(state.plan!.total, 2);
      expect(state.plan!.doneCount, 1);
      expect(state.plan!.lines.first.customerName, 'عميل 1');
      expect(state.plan!.lines.first.status, 'PLANNED');
      expect(state.plan!.lines[1].isDone, isTrue);
    });

    test('لا توجد خطة اليوم → خطة فارغة بلا بنود', () async {
      await setUpContainer();
      flags['empty'] = true;
      final controller = container.read(visitPlanControllerProvider.notifier);

      await controller.refresh();

      final state = container.read(visitPlanControllerProvider);
      expect(state.plan, isNotNull);
      expect(state.plan!.isEmpty, isTrue);
      expect(state.hasPlan, isFalse);
    });

    test('تعليم «تمت» يُرسل الحالة ويحدّث الخطة', () async {
      await setUpContainer();
      final controller = container.read(visitPlanControllerProvider.notifier);
      await controller.refresh();

      final ok = await controller.mark(lineId: 1, missed: false);

      expect(ok, isTrue);
      final state = container.read(visitPlanControllerProvider);
      expect(state.plan!.lines.first.isDone, isTrue);
      expect(state.plan!.doneCount, 2);
      final sent = byPath('/visits/plans/7/lines/1/status').single;
      expect(bodyOf(sent)['status'], 'DONE');
    });

    test('تعليم «لم تتم» يُرسل الحالة والسبب', () async {
      await setUpContainer();
      final controller = container.read(visitPlanControllerProvider.notifier);
      await controller.refresh();

      final ok = await controller.mark(lineId: 1, missed: true, reason: '  العميل مغلق  ');

      expect(ok, isTrue);
      final state = container.read(visitPlanControllerProvider);
      expect(state.plan!.lines.first.isMissed, isTrue);
      final sent = byPath('/visits/plans/7/lines/1/status').single;
      expect(bodyOf(sent)['status'], 'MISSED');
      expect(bodyOf(sent)['notes'], 'العميل مغلق');
    });

    test('فشل الخادم يُظهر الخطأ ولا يبني خطة', () async {
      await setUpContainer();
      flags['fail'] = true;
      final controller = container.read(visitPlanControllerProvider.notifier);

      await controller.refresh();

      final state = container.read(visitPlanControllerProvider);
      expect(state.error, isNotNull);
      expect(state.hasPlan, isFalse);
    });

    test('التحديث دون خطة محمّلة لا يُرسل شيئاً', () async {
      await setUpContainer();
      final controller = container.read(visitPlanControllerProvider.notifier);

      final ok = await controller.mark(lineId: 1, missed: false);

      expect(ok, isFalse);
      expect(byPath('/visits/plans'), isEmpty);
    });
  });
}