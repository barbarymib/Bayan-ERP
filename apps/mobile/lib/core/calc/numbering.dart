/// ترقيم المستندات — كلون مطابق لـ packages/shared/src/numbering.ts.
library;

enum DocKind { priceStatement, purchaseStatement, returnStatement, receipt, payment }

const Map<DocKind, String> _prefixes = {
  DocKind.priceStatement: 'BP',
  DocKind.purchaseStatement: 'PR',
  DocKind.returnStatement: 'RT',
  DocKind.receipt: 'RC',
  DocKind.payment: 'PV',
};

String prefixOf(DocKind kind) => _prefixes[kind]!;

class NumberBlock {
  final DocKind kind;
  final String repCode;
  final int from;
  final int to;
  const NumberBlock({required this.kind, required this.repCode, required this.from, required this.to});
}

String formatDocNumber(DocKind kind, String repCode, int sequence) {
  if (sequence < 1) throw ArgumentError('Invalid sequence: $sequence');
  final prefix = prefixOf(kind);
  final body = sequence.toString().padLeft(6, '0');
  return repCode.isEmpty ? '$prefix-$body' : '$prefix-$repCode-$body';
}

/// تنسيق رقم مستند من بادئة خام (BP/RT/RC) — يُستخدم مع كتل أرقام الخادم.
String formatDocNumberByPrefix(String prefix, String repCode, int sequence) {
  if (sequence < 1) throw ArgumentError('Invalid sequence: $sequence');
  final body = sequence.toString().padLeft(6, '0');
  return repCode.isEmpty ? '$prefix-$body' : '$prefix-$repCode-$body';
}

NumberBlock reserveNextBlock(DocKind kind, String repCode, int? lastUsed, {int size = 100}) {
  if (size <= 0) throw ArgumentError('size must be positive');
  final from = (lastUsed ?? 0) + 1;
  return NumberBlock(kind: kind, repCode: repCode, from: from, to: from + size - 1);
}

int nextSequenceInBlock(NumberBlock block, int? lastUsed) {
  final next = (lastUsed ?? block.from - 1) + 1;
  if (next > block.to) {
    throw StateError('Number block exhausted for ${prefixOf(block.kind)}');
  }
  return next;
}

bool isSequenceInBlock(NumberBlock block, int sequence) =>
    sequence >= block.from && sequence <= block.to;