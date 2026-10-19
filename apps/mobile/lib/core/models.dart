/// حالة مستند على الجهاز / الخادم — تُعرض للمندوب بلون مميز.
enum SyncStatus {
  /// أُنشئ محلياً ولم يُرفع بعد.
  local,

  /// قيد الرفع الآن.
  uploading,

  /// رُفع بنجاح وفي انتظار الاعتماد.
  uploaded,

  /// تغيّر السعر/الرصيد أثناء الأوفلاين → بانتظار مراجعة المكتب.
  pendingReview,

  /// اعتمده المكتب.
  approved,

  /// رفضه المكتب.
  rejected;

  static SyncStatus fromCode(String? code) {
    switch (code) {
      case 'UPLOADED':
        return SyncStatus.uploaded;
      case 'PENDING_REVIEW':
        return SyncStatus.pendingReview;
      case 'APPROVED':
        return SyncStatus.approved;
      case 'REJECTED':
        return SyncStatus.rejected;
      case 'UPLOADING':
        return SyncStatus.uploading;
      default:
        return SyncStatus.local;
    }
  }

  /// هل ينبغي إيقاف إعادة المحاولة؟
  bool get isTerminal =>
      this == SyncStatus.uploaded ||
      this == SyncStatus.pendingReview ||
      this == SyncStatus.approved ||
      this == SyncStatus.rejected;
}

/// تنبيه تسعير (§5.3): سعر تحت التكلفة أو تحت حد السعر الأدنى — يعيده الخادم مع رفع البيان.
class PricingAlert {
  final String type; // below_cost | below_min_price
  final String itemCode;
  final double unitPrice;
  final double threshold;

  const PricingAlert({
    required this.type,
    required this.itemCode,
    required this.unitPrice,
    required this.threshold,
  });

  factory PricingAlert.fromJson(Map<String, dynamic> j) => PricingAlert(
        type: j['type'] as String? ?? '',
        itemCode: j['itemCode'] as String? ?? '',
        unitPrice: ((j['unitPrice'] as num?) ?? 0).toDouble(),
        threshold: ((j['threshold'] as num?) ?? 0).toDouble(),
      );
}

/// هوية المستخدم كما يعيدها `/auth/login` (مطابقة لـ AuthUser في الـ API).
class AuthUser {
  final int id;
  final String name;
  final String roleCode;
  final String? repCode;
  final List<String> permissions;
  final double maxItemDiscountPct;
  final double maxInvoiceDiscountPct;
  final int? companyId;

  const AuthUser({
    required this.id,
    required this.name,
    required this.roleCode,
    this.repCode,
    this.permissions = const [],
    this.maxItemDiscountPct = 0,
    this.maxInvoiceDiscountPct = 0,
    this.companyId,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'roleCode': roleCode,
        'repCode': repCode,
        'permissions': permissions,
        'maxItemDiscountPct': maxItemDiscountPct,
        'maxInvoiceDiscountPct': maxInvoiceDiscountPct,
        'companyId': companyId,
      };

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: (j['id'] as num).toInt(),
        name: j['name'] as String,
        roleCode: j['roleCode'] as String? ?? '',
        repCode: j['repCode'] as String?,
        permissions:
            ((j['permissions'] as List?) ?? const []).map((e) => e as String).toList(),
        maxItemDiscountPct:
            ((j['maxItemDiscountPct'] as num?) ?? 0).toDouble(),
        maxInvoiceDiscountPct:
            ((j['maxInvoiceDiscountPct'] as num?) ?? 0).toDouble(),
        companyId: (j['companyId'] as num?)?.toInt(),
      );
}

class ItemSummary {
  final int id;
  final String code;
  final String name;
  final String? baseUnit;
  final double? lastPrice;
  final String? categoryCode;
  final String? barcode;
  final List<ItemUnitSummary> units;

  const ItemSummary({
    required this.id,
    required this.code,
    required this.name,
    this.baseUnit,
    this.lastPrice,
    this.categoryCode,
    this.barcode,
    this.units = const [],
  });

  /// صنف حديد — تُفعَّل له ملاحظة الوزن الفعلي (§5.2).
  bool get isSteel => categoryCode == 'STEEL';

  factory ItemSummary.fromJson(Map<String, dynamic> j) => ItemSummary(
        id: (j['id'] as num).toInt(),
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
        baseUnit: j['baseUnit'] as String?,
        lastPrice: (j['lastPrice'] as num?)?.toDouble(),
        categoryCode: j['categoryCode'] as String?,
        barcode: j['barcode'] as String?,
        units: ((j['units'] as List?) ?? const [])
            .map((e) => ItemUnitSummary.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

/// وحدة بيع/شراء مُزامَنة لصنف: باركود الوحدة + عامل التحويل للأساس (§5.1/G13).
class ItemUnitSummary {
  final int unitId;
  final String? unitCode;
  final double factorToBase;
  final bool allowDecimal;
  final String? barcode;
  final bool isSale;
  final bool isPurchase;

  const ItemUnitSummary({
    required this.unitId,
    this.unitCode,
    required this.factorToBase,
    this.allowDecimal = true,
    this.barcode,
    this.isSale = true,
    this.isPurchase = true,
  });

  factory ItemUnitSummary.fromJson(Map<String, dynamic> j) => ItemUnitSummary(
        unitId: (j['unitId'] as num).toInt(),
        unitCode: j['unitCode'] as String?,
        factorToBase: (j['factorToBase'] as num?)?.toDouble() ?? 1,
        allowDecimal: j['allowDecimal'] as bool? ?? true,
        barcode: j['barcode'] as String?,
        isSale: j['isSale'] as bool? ?? true,
        isPurchase: j['isPurchase'] as bool? ?? true,
      );
}

/// آخر بيان أسعار للعميل (مُلخَّص للموبايل).
class LastStatement {
  final int id;
  final String number;
  final DateTime date;
  final double net;
  final String status;

  const LastStatement({
    required this.id,
    required this.number,
    required this.date,
    required this.net,
    required this.status,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'number': number,
        'date': date.toIso8601String(),
        'net': net,
        'status': status,
      };

  factory LastStatement.fromJson(Map<String, dynamic> j) => LastStatement(
        id: (j['id'] as num).toInt(),
        number: j['number'] as String? ?? '',
        date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime.now(),
        net: ((j['net'] as num?) ?? 0).toDouble(),
        status: j['status'] as String? ?? '',
      );
}

/// سعر صنف داخل قائمة أسعار.
class ItemPriceEntry {
  final int itemId;
  final int unitId;
  final double price;

  const ItemPriceEntry({
    required this.itemId,
    required this.unitId,
    required this.price,
  });

  Map<String, dynamic> toJson() => {'itemId': itemId, 'unitId': unitId, 'price': price};

  factory ItemPriceEntry.fromJson(Map<String, dynamic> j) => ItemPriceEntry(
        itemId: (j['itemId'] as num).toInt(),
        unitId: (j['unitId'] as num).toInt(),
        price: ((j['price'] as num?) ?? 0).toDouble(),
      );
}

/// قائمة أسعار (RETAIL/WHOLESALE...) مع أسعار أصنافها.
class PriceListSummary {
  final int id;
  final String code;
  final String name;
  final List<ItemPriceEntry> prices;

  const PriceListSummary({
    required this.id,
    required this.code,
    required this.name,
    this.prices = const [],
  });

  double? priceFor(int itemId, {int? unitId}) {
    for (final p in prices) {
      if (p.itemId == itemId && (unitId == null || p.unitId == unitId)) return p.price;
    }
    return null;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
        'prices': prices.map((p) => p.toJson()).toList(),
      };

  factory PriceListSummary.fromJson(Map<String, dynamic> j) => PriceListSummary(
        id: (j['id'] as num).toInt(),
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
        prices: ((j['prices'] as List?) ?? const [])
            .map((e) => ItemPriceEntry.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

/// بند بيان أسعار مُخزَّن على الخادم (يُستخدم لإصدار المرتجعات أوفلاين).
class StatementLineSummary {
  final int id;
  final int itemId;
  final int unitId;
  final double qty;
  final double qtyBase;
  final double unitPrice;
  final double netLine;

  const StatementLineSummary({
    required this.id,
    required this.itemId,
    required this.unitId,
    required this.qty,
    required this.qtyBase,
    required this.unitPrice,
    required this.netLine,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'itemId': itemId,
        'unitId': unitId,
        'qty': qty,
        'qtyBase': qtyBase,
        'unitPrice': unitPrice,
        'netLine': netLine,
      };

  factory StatementLineSummary.fromJson(Map<String, dynamic> j) => StatementLineSummary(
        id: (j['id'] as num).toInt(),
        itemId: (j['itemId'] as num).toInt(),
        unitId: (j['unitId'] as num).toInt(),
        qty: ((j['qty'] as num?) ?? 0).toDouble(),
        qtyBase: ((j['qtyBase'] as num?) ?? 0).toDouble(),
        unitPrice: ((j['unitPrice'] as num?) ?? 0).toDouble(),
        netLine: ((j['netLine'] as num?) ?? 0).toDouble(),
      );
}

/// بيان أسعار معتمد من الخادم (لإصدار المرتجعات أوفلاين).
class StatementSummary {
  final int id;
  final String number;
  final int customerId;
  final DateTime date;
  final String status;
  final double net;
  final List<StatementLineSummary> lines;

  const StatementSummary({
    required this.id,
    required this.number,
    required this.customerId,
    required this.date,
    required this.status,
    required this.net,
    this.lines = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'number': number,
        'customerId': customerId,
        'date': date.toIso8601String(),
        'status': status,
        'net': net,
        'lines': lines.map((l) => l.toJson()).toList(),
      };

  factory StatementSummary.fromJson(Map<String, dynamic> j) => StatementSummary(
        id: (j['id'] as num).toInt(),
        number: j['number'] as String? ?? '',
        customerId: (j['customerId'] as num).toInt(),
        date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime.now(),
        status: j['status'] as String? ?? '',
        net: ((j['net'] as num?) ?? 0).toDouble(),
        lines: ((j['lines'] as List?) ?? const [])
            .map((e) => StatementLineSummary.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

class CustomerSummary {
  final int id;
  final String code;
  final String name;
  final String? phone;
  final double balance;
  final double? lat;
  final double? lng;
  final int? priceListId;
  final LastStatement? lastStatement;

  const CustomerSummary({
    required this.id,
    required this.code,
    required this.name,
    this.phone,
    this.balance = 0,
    this.lat,
    this.lng,
    this.priceListId,
    this.lastStatement,
  });

  factory CustomerSummary.fromJson(Map<String, dynamic> j) => CustomerSummary(
        id: (j['id'] as num).toInt(),
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
        phone: j['phone'] as String?,
        balance: ((j['balance'] as num?) ?? 0).toDouble(),
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        priceListId: (j['priceListId'] as num?)?.toInt(),
        lastStatement: j['lastStatement'] == null
            ? null
            : LastStatement.fromJson((j['lastStatement'] as Map).cast<String, dynamic>()),
      );
}

/// كتلة أرقام مخصصة للجهاز (ترقيم آمن أوفلاين).
class NumberBlock {
  final String kind;
  final String repCode;
  final int from;
  final int to;
  final int used;

  const NumberBlock({
    required this.kind,
    required this.repCode,
    required this.from,
    required this.to,
    this.used = 0,
  });

  int get remaining => (to - from + 1) - used;
  bool get exhausted => remaining <= 0;

  factory NumberBlock.fromJson(Map<String, dynamic> j) => NumberBlock(
        kind: j['kind'] as String,
        repCode: j['repCode'] as String? ?? '',
        from: (j['from'] as num).toInt(),
        to: (j['to'] as num).toInt(),
        used: (j['used'] as num?)?.toInt() ?? 0,
      );
}

/// نتيجة المزامنة التفاضلية (Delta Sync).
class DeltaPayload {
  final DateTime serverTime;
  final List<ItemSummary> items;
  final List<CustomerSummary> customers;
  final List<NumberBlock> blocks;
  final List<PriceListSummary> priceLists;
  final List<StatementSummary> statements;

  const DeltaPayload({
    required this.serverTime,
    this.items = const [],
    this.customers = const [],
    this.blocks = const [],
    this.priceLists = const [],
    this.statements = const [],
  });

  /// سعر الصنف لعميل محدد انطلاقاً من قائمة أسعاره.
  double? priceForCustomer(int customerId, int itemId, {int? unitId}) {
    CustomerSummary? customer;
    for (final c in customers) {
      if (c.id == customerId) customer = c;
    }
    if (customer?.priceListId == null) return null;
    for (final pl in priceLists) {
      if (pl.id == customer!.priceListId) return pl.priceFor(itemId, unitId: unitId);
    }
    return null;
  }
}

/// وردية تتبع نشطة/سابقة كما يعيدها `/geo/shifts/start|end|current`.
class ActiveShift {
  final int id;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int locations;
  final int visits;

  const ActiveShift({
    required this.id,
    required this.startedAt,
    this.endedAt,
    this.locations = 0,
    this.visits = 0,
  });

  factory ActiveShift.fromJson(Map<String, dynamic> j) {
    final count = j['_count'];
    final countMap = count is Map ? count.cast<String, dynamic>() : const <String, dynamic>{};
    return ActiveShift(
      id: j['id'] as int,
      startedAt: DateTime.tryParse(j['startedAt']?.toString() ?? '') ?? DateTime.now(),
      endedAt: j['endedAt'] == null ? null : DateTime.tryParse(j['endedAt'].toString()),
      locations: (countMap['locations'] as num?)?.toInt() ?? 0,
      visits: (countMap['visits'] as num?)?.toInt() ?? 0,
    );
  }
}

/// نتيجة تسجيل زيارة عميل (تتضمن قرب الموقع من العميل — §5.13).
class VisitResult {
  final int id;
  final String customerName;
  final String status;
  final String? reason;
  final bool outOfRange;
  final int? distanceM;

  const VisitResult({
    required this.id,
    required this.customerName,
    required this.status,
    this.reason,
    this.outOfRange = false,
    this.distanceM,
  });

  bool get isMissed => status == 'MISSED';

  factory VisitResult.fromJson(Map<String, dynamic> j) {
    final customer = j['customer'];
    final prox = j['proximity'];
    return VisitResult(
      id: j['id'] as int,
      customerName:
          (customer is Map ? (customer['nameAr'] ?? customer['name']) : null)?.toString() ?? '',
      status: j['status']?.toString() ?? 'DONE',
      reason: j['reason'] as String?,
      outOfRange: prox is Map && prox['outOfRange'] == true,
      distanceM: prox is Map ? (prox['distanceM'] as num?)?.toInt() : null,
    );
  }
}

/// بند في خطة زيارات يومية (مع بيانات العميل — §5.12).
class VisitPlanLine {
  final int id;
  final int customerId;
  final int sequence;
  final String status;
  final String? notes;
  final String customerName;
  final String? customerCode;
  final String? customerPhone;
  final double? lat;
  final double? lng;

  const VisitPlanLine({
    required this.id,
    required this.customerId,
    this.sequence = 0,
    this.status = 'PLANNED',
    this.notes,
    this.customerName = '',
    this.customerCode,
    this.customerPhone,
    this.lat,
    this.lng,
  });

  bool get isDone => status == 'DONE';
  bool get isMissed => status == 'MISSED';
  bool get isPlanned => !isDone && !isMissed;

  factory VisitPlanLine.fromJson(Map<String, dynamic> j) {
    final customer = j['customer'];
    final map = customer is Map ? customer.cast<String, dynamic>() : const <String, dynamic>{};
    return VisitPlanLine(
      id: (j['id'] as num).toInt(),
      customerId: ((j['customerId'] ?? map['id']) as num).toInt(),
      sequence: (j['sequence'] as num?)?.toInt() ?? 0,
      status: j['status']?.toString() ?? 'PLANNED',
      notes: j['notes'] as String?,
      customerName:
          (map['nameAr'] ?? map['name'])?.toString() ?? '',
      customerCode: map['code']?.toString(),
      customerPhone: map['phone']?.toString(),
      lat: (map['lat'] as num?)?.toDouble(),
      lng: (map['lng'] as num?)?.toDouble(),
    );
  }
}

/// خطة زيارات يومية (قد تكون بلا خطة: [id] = null وخطوط فارغة).
class VisitPlan {
  final int? id;
  final DateTime date;
  final String? notes;
  final List<VisitPlanLine> lines;

  const VisitPlan({
    this.id,
    required this.date,
    this.notes,
    this.lines = const [],
  });

  bool get isEmpty => lines.isEmpty;
  int get total => lines.length;
  int get doneCount => lines.where((l) => l.isDone).length;
  int get missedCount => lines.where((l) => l.isMissed).length;

  factory VisitPlan.fromJson(Map<String, dynamic> j) => VisitPlan(
        id: (j['id'] as num?)?.toInt(),
        date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime.now(),
        notes: j['notes'] as String?,
        lines: ((j['lines'] as List?) ?? const [])
            .map((e) => VisitPlanLine.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}

/// يقبل قيمة عشرية قادمة إما كرقم أو كنص (Prisma Decimal يُسلسل كنص).
double _decimal(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0;
  return 0;
}

/// محضر تسليم عهدة نقدية من مندوب للخزينة (§5.10).
class CustodyHandover {
  final int id;
  final String number;
  final int repId;
  final double amount;
  final DateTime date;
  final int? cashAccountId;
  final String? notes;
  final String status;

  const CustodyHandover({
    required this.id,
    required this.number,
    required this.repId,
    required this.amount,
    required this.date,
    this.cashAccountId,
    this.notes,
    this.status = '',
  });

  factory CustodyHandover.fromJson(Map<String, dynamic> j) => CustodyHandover(
        id: (j['id'] as num).toInt(),
        number: j['number'] as String? ?? '',
        repId: (j['repId'] as num?)?.toInt() ?? 0,
        amount: _decimal(j['amount']),
        date: DateTime.tryParse(j['date']?.toString() ?? '') ?? DateTime.now(),
        cashAccountId: (j['cashAccountId'] as num?)?.toInt(),
        notes: j['notes'] as String?,
        status: j['status'] as String? ?? '',
      );
}