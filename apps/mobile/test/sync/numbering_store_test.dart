import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/numbering_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NumberingState.applyBlocks', () {
    test('initializes a range from a server block', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 20, used: 0),
        ]);
      expect(s.hasBlock('BP', 'M03'), isTrue);
      expect(s.used('BP', 'M03'), 0);
      expect(s.canIssue('BP', 'M03'), isTrue);
    });

    test('issues sequential formatted numbers and tracks usage', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 3, used: 0),
        ]);
      expect(s.next('BP', 'M03'), 'BP-M03-000001');
      expect(s.next('BP', 'M03'), 'BP-M03-000002');
      expect(s.used('BP', 'M03'), 2);
      expect(s.next('BP', 'M03'), 'BP-M03-000003');
      expect(s.next('BP', 'M03'), isNull, reason: 'block exhausted');
      expect(s.canIssue('BP', 'M03'), isFalse);
    });

    test('extends range upper bound when a larger block arrives', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 2, used: 0),
        ]);
      s.next('BP', 'M03');
      s.applyBlocks(const [
        NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 10, used: 0),
      ]);
      expect(s.used('BP', 'M03'), 1);
      expect(s.next('BP', 'M03'), 'BP-M03-000002');
    });

    test('ignores a smaller/duplicate block', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 20, used: 0),
        ]);
      s.applyBlocks(const [
        NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 5, used: 0),
      ]);
      expect(s.next('BP', 'M03'), 'BP-M03-000001');
      for (var i = 2; i <= 20; i++) {
        s.next('BP', 'M03');
      }
      expect(s.next('BP', 'M03'), isNull);
    });

    test('separates ranges per kind and per rep', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 5, used: 0),
          NumberBlock(kind: 'RT', repCode: 'M03', from: 1, to: 5, used: 0),
          NumberBlock(kind: 'RC', repCode: 'M04', from: 1, to: 5, used: 0),
        ]);
      expect(s.next('BP', 'M03'), 'BP-M03-000001');
      expect(s.next('RT', 'M03'), 'RT-M03-000001');
      expect(s.next('RC', 'M04'), 'RC-M04-000001');
    });

    test('returns null when no block exists', () {
      final s = NumberingState();
      expect(s.canIssue('BP', 'M03'), isFalse);
      expect(s.next('BP', 'M03'), isNull);
    });
  });

  group('NumberingState serialization', () {
    test('round-trips ranges', () {
      final s = NumberingState()
        ..applyBlocks(const [
          NumberBlock(kind: 'BP', repCode: 'M03', from: 1, to: 20, used: 0),
        ]);
      s.next('BP', 'M03');
      final restored = NumberingState.fromJson(s.toJson());
      expect(restored.used('BP', 'M03'), 1);
      expect(restored.next('BP', 'M03'), 'BP-M03-000002');
    });

    test('empty json yields empty state', () {
      final restored = NumberingState.fromJson(null);
      expect(restored.ranges, isEmpty);
    });
  });
}