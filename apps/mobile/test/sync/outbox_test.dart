import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:flutter_test/flutter_test.dart';

OutboxItem _item(String uuid, {String type = 'price_statement', DateTime? createdAt}) =>
    OutboxItem(
      clientUuid: uuid,
      type: type,
      payload: const {},
      createdAt: createdAt ?? DateTime(2026, 1, 1),
    );

void main() {
  final base = DateTime(2026, 1, 1, 8, 0, 0);

  group('backoffDelay — تراجع أسبي حتمي', () {
    test('المحاولات تضاعف: 2، 4، 8… ثم سقف 5 دقائق', () {
      expect(backoffDelay(1, base: Duration.zero).inMilliseconds, 0);
      expect(backoffDelay(2, base: Duration.zero).inMilliseconds, 0);
      expect(backoffDelay(0, base: const Duration(seconds: 2)).inSeconds, 0);

      final policy = const BackoffPolicy();
      expect(policy.delayFor(1).inSeconds, 2);
      expect(policy.delayFor(2).inSeconds, 4);
      expect(policy.delayFor(3).inSeconds, 8);
      expect(policy.delayFor(4).inSeconds, 16);
      expect(policy.delayFor(5).inSeconds, 32);
      expect(policy.delayFor(6).inSeconds, 64);
      expect(policy.delayFor(7).inSeconds, 128);
      expect(policy.delayFor(8).inSeconds, 256);
      expect(policy.delayFor(9).inSeconds, 300, reason: 'السقف 5 دقائق');
      expect(policy.delayFor(20).inSeconds, 300, reason: 'يبقى محصوراً عند السقف');
    });

    test('الارتجاج حتمي (نفس المدخلات ← نفس الناتج)', () {
      final a = const BackoffPolicy().delayFor(3, jitterSeed: 7);
      final b = const BackoffPolicy().delayFor(3, jitterSeed: 7);
      expect(a, b);
    });

    test('الارتجاج يضيف وقتاً في المجال الصحيح', () {
      final p = const BackoffPolicy(base: Duration(seconds: 10));
      final d = p.delayFor(1, jitterSeed: 5).inMilliseconds;
      expect(d, greaterThanOrEqualTo(10000));
      expect(d, lessThanOrEqualTo(15000));
    });
  });

  group('الصندوق', () {
    test('يمنع تكرار client_uuid (لا فقد ولا تكرار رقم)', () {
      final o = Outbox();
      expect(o.add(_item('a')), isTrue);
      expect(o.add(_item('a')), isFalse);
      expect(o.length, 1);
    });

    test('الجاهز للرفع يعود بترتيب FIFO', () {
      final o = Outbox();
      o.add(_item('c', createdAt: DateTime(2026, 1, 1, 3)));
      o.add(_item('a', createdAt: DateTime(2026, 1, 1, 1)));
      o.add(_item('b', createdAt: DateTime(2026, 1, 1, 2)));
      expect(o.ready(base).map((e) => e.clientUuid).toList(), ['a', 'b', 'c']);
    });

    test('العنصر النهائي لا يدخل الجاهز', () {
      final o = Outbox();
      o.add(_item('done'));
      o.markSuccess('done', status: SyncStatus.approved, serverId: 9);
      expect(o.ready(base), isEmpty);
      expect(o.pending, isEmpty);
      expect(o.byUuid('done')!.serverId, 9);
      expect(o.byUuid('done')!.status, SyncStatus.approved);
    });

    test('الفشل يؤجل المحاولة التالية بحسب التراجع', () {
      final o = Outbox();
      o.add(_item('x'));
      o.markFailure('x', 'انقطاع', base);
      final i = o.byUuid('x')!;
      expect(i.attempts, 1);
      expect(i.nextAttemptAt.isAfter(base), isTrue);
      expect(i.status, SyncStatus.local);

      // لا يعود جاهزاً قبل انتهاء التأخير…
      expect(o.ready(base), isEmpty);
      // …لكن يعود بعد ذلك.
      expect(o.ready(base.add(const Duration(seconds: 10))).length, 1);
    });

    test('يكفّ بعد بلوغ الحد الأقصى للمحاولات', () {
      final policy = const BackoffPolicy(maxAttempts: 3);
      final o = Outbox(policy: policy);
      o.add(_item('y'));
      o.markFailure('y', '1', base);
      o.markFailure('y', '2', base);
      o.markFailure('y', '3', base);
      expect(o.hasReachedMaxAttempts, isTrue);
      expect(o.ready(base.add(const Duration(days: 1))), isEmpty);
      expect(o.failedCount, 1);
      expect(o.byUuid('y')!.attempts, 3);
    });

    test('الحفظ والاستعادة عبر JSON يبقي الحالة والمحاولات', () {
      final o = Outbox();
      o.add(_item('z', type: 'receipt'));
      o.markFailure('z', 'فشل', base);
      final restored = Outbox.fromJson(o.toJson());
      expect(restored.length, 1);
      final i = restored.byUuid('z')!;
      expect(i.type, 'receipt');
      expect(i.attempts, 1);
      expect(i.lastError, 'فشل');
      expect(i.status, SyncStatus.local);
    });

    test('يعدّ العناصر بانتظار المراجعة (لا محاولات لها)', () {
      final o = Outbox();
      o.add(_item('p1'));
      o.add(_item('p2'));
      o.add(_item('ok'));
      o.markSuccess('p1', status: SyncStatus.pendingReview, serverId: 11);
      o.markSuccess('p2', status: SyncStatus.pendingReview, serverId: 12);
      o.markSuccess('ok', status: SyncStatus.approved, serverId: 13);
      expect(o.pendingReviewCount, 2);
    });

    test('resetAttempts يعيد ضبط الفاشل فقط ويجعله جاهزاً فوراً', () {
      final o = Outbox();
      o.add(_item('f1'));
      o.add(_item('f2'));
      o.markSuccess('f2', status: SyncStatus.approved, serverId: 7);
      o.markFailure('f1', 'انقطاع', base);
      o.markFailure('f1', 'انقطاع', base);
      expect(o.failedCount, 1);
      expect(o.ready(base), isEmpty, reason: 'الحمل لا يزال مؤجلاً');

      final reset = o.resetAttempts(base);

      expect(reset, 1);
      final i = o.byUuid('f1')!;
      expect(i.attempts, 0);
      expect(i.lastError, isNull);
      expect(o.failedCount, 0);
      expect(o.ready(base).map((e) => e.clientUuid), ['f1']);
      // العنصر المعتمد لا يُمَسّ.
      expect(o.byUuid('f2')!.status, SyncStatus.approved);
    });
  });

  group('SyncStatus', () {
    test('fromCode يغطي حالات الخادم', () {
      expect(SyncStatus.fromCode('APPROVED'), SyncStatus.approved);
      expect(SyncStatus.fromCode('PENDING_REVIEW'), SyncStatus.pendingReview);
      expect(SyncStatus.fromCode('REJECTED'), SyncStatus.rejected);
      expect(SyncStatus.fromCode(null), SyncStatus.local);
    });

    test('isTerminal', () {
      expect(SyncStatus.approved.isTerminal, isTrue);
      expect(SyncStatus.uploaded.isTerminal, isTrue);
      expect(SyncStatus.local.isTerminal, isFalse);
      expect(SyncStatus.uploading.isTerminal, isFalse);
    });
  });
}