// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $ItemsTable extends Items with TableInfo<$ItemsTable, Item> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
    'code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _baseUnitMeta = const VerificationMeta(
    'baseUnit',
  );
  @override
  late final GeneratedColumn<String> baseUnit = GeneratedColumn<String>(
    'base_unit',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastPriceMeta = const VerificationMeta(
    'lastPrice',
  );
  @override
  late final GeneratedColumn<double> lastPrice = GeneratedColumn<double>(
    'last_price',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _categoryCodeMeta = const VerificationMeta(
    'categoryCode',
  );
  @override
  late final GeneratedColumn<String> categoryCode = GeneratedColumn<String>(
    'category_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _barcodeMeta = const VerificationMeta(
    'barcode',
  );
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
    'barcode',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    code,
    name,
    baseUnit,
    lastPrice,
    categoryCode,
    barcode,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'items';
  @override
  VerificationContext validateIntegrity(
    Insertable<Item> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('code')) {
      context.handle(
        _codeMeta,
        code.isAcceptableOrUnknown(data['code']!, _codeMeta),
      );
    } else if (isInserting) {
      context.missing(_codeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('base_unit')) {
      context.handle(
        _baseUnitMeta,
        baseUnit.isAcceptableOrUnknown(data['base_unit']!, _baseUnitMeta),
      );
    }
    if (data.containsKey('last_price')) {
      context.handle(
        _lastPriceMeta,
        lastPrice.isAcceptableOrUnknown(data['last_price']!, _lastPriceMeta),
      );
    }
    if (data.containsKey('category_code')) {
      context.handle(
        _categoryCodeMeta,
        categoryCode.isAcceptableOrUnknown(
          data['category_code']!,
          _categoryCodeMeta,
        ),
      );
    }
    if (data.containsKey('barcode')) {
      context.handle(
        _barcodeMeta,
        barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Item map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Item(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      code: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}code'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      baseUnit: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}base_unit'],
      ),
      lastPrice: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}last_price'],
      ),
      categoryCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}category_code'],
      ),
      barcode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}barcode'],
      ),
    );
  }

  @override
  $ItemsTable createAlias(String alias) {
    return $ItemsTable(attachedDatabase, alias);
  }
}

class Item extends DataClass implements Insertable<Item> {
  final int id;
  final String code;
  final String name;
  final String? baseUnit;
  final double? lastPrice;
  final String? categoryCode;
  final String? barcode;
  const Item({
    required this.id,
    required this.code,
    required this.name,
    this.baseUnit,
    this.lastPrice,
    this.categoryCode,
    this.barcode,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['code'] = Variable<String>(code);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || baseUnit != null) {
      map['base_unit'] = Variable<String>(baseUnit);
    }
    if (!nullToAbsent || lastPrice != null) {
      map['last_price'] = Variable<double>(lastPrice);
    }
    if (!nullToAbsent || categoryCode != null) {
      map['category_code'] = Variable<String>(categoryCode);
    }
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    return map;
  }

  ItemsCompanion toCompanion(bool nullToAbsent) {
    return ItemsCompanion(
      id: Value(id),
      code: Value(code),
      name: Value(name),
      baseUnit: baseUnit == null && nullToAbsent
          ? const Value.absent()
          : Value(baseUnit),
      lastPrice: lastPrice == null && nullToAbsent
          ? const Value.absent()
          : Value(lastPrice),
      categoryCode: categoryCode == null && nullToAbsent
          ? const Value.absent()
          : Value(categoryCode),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
    );
  }

  factory Item.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Item(
      id: serializer.fromJson<int>(json['id']),
      code: serializer.fromJson<String>(json['code']),
      name: serializer.fromJson<String>(json['name']),
      baseUnit: serializer.fromJson<String?>(json['baseUnit']),
      lastPrice: serializer.fromJson<double?>(json['lastPrice']),
      categoryCode: serializer.fromJson<String?>(json['categoryCode']),
      barcode: serializer.fromJson<String?>(json['barcode']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'code': serializer.toJson<String>(code),
      'name': serializer.toJson<String>(name),
      'baseUnit': serializer.toJson<String?>(baseUnit),
      'lastPrice': serializer.toJson<double?>(lastPrice),
      'categoryCode': serializer.toJson<String?>(categoryCode),
      'barcode': serializer.toJson<String?>(barcode),
    };
  }

  Item copyWith({
    int? id,
    String? code,
    String? name,
    Value<String?> baseUnit = const Value.absent(),
    Value<double?> lastPrice = const Value.absent(),
    Value<String?> categoryCode = const Value.absent(),
    Value<String?> barcode = const Value.absent(),
  }) => Item(
    id: id ?? this.id,
    code: code ?? this.code,
    name: name ?? this.name,
    baseUnit: baseUnit.present ? baseUnit.value : this.baseUnit,
    lastPrice: lastPrice.present ? lastPrice.value : this.lastPrice,
    categoryCode: categoryCode.present ? categoryCode.value : this.categoryCode,
    barcode: barcode.present ? barcode.value : this.barcode,
  );
  Item copyWithCompanion(ItemsCompanion data) {
    return Item(
      id: data.id.present ? data.id.value : this.id,
      code: data.code.present ? data.code.value : this.code,
      name: data.name.present ? data.name.value : this.name,
      baseUnit: data.baseUnit.present ? data.baseUnit.value : this.baseUnit,
      lastPrice: data.lastPrice.present ? data.lastPrice.value : this.lastPrice,
      categoryCode: data.categoryCode.present
          ? data.categoryCode.value
          : this.categoryCode,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Item(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('baseUnit: $baseUnit, ')
          ..write('lastPrice: $lastPrice, ')
          ..write('categoryCode: $categoryCode, ')
          ..write('barcode: $barcode')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, code, name, baseUnit, lastPrice, categoryCode, barcode);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Item &&
          other.id == this.id &&
          other.code == this.code &&
          other.name == this.name &&
          other.baseUnit == this.baseUnit &&
          other.lastPrice == this.lastPrice &&
          other.categoryCode == this.categoryCode &&
          other.barcode == this.barcode);
}

class ItemsCompanion extends UpdateCompanion<Item> {
  final Value<int> id;
  final Value<String> code;
  final Value<String> name;
  final Value<String?> baseUnit;
  final Value<double?> lastPrice;
  final Value<String?> categoryCode;
  final Value<String?> barcode;
  const ItemsCompanion({
    this.id = const Value.absent(),
    this.code = const Value.absent(),
    this.name = const Value.absent(),
    this.baseUnit = const Value.absent(),
    this.lastPrice = const Value.absent(),
    this.categoryCode = const Value.absent(),
    this.barcode = const Value.absent(),
  });
  ItemsCompanion.insert({
    this.id = const Value.absent(),
    required String code,
    required String name,
    this.baseUnit = const Value.absent(),
    this.lastPrice = const Value.absent(),
    this.categoryCode = const Value.absent(),
    this.barcode = const Value.absent(),
  }) : code = Value(code),
       name = Value(name);
  static Insertable<Item> custom({
    Expression<int>? id,
    Expression<String>? code,
    Expression<String>? name,
    Expression<String>? baseUnit,
    Expression<double>? lastPrice,
    Expression<String>? categoryCode,
    Expression<String>? barcode,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (code != null) 'code': code,
      if (name != null) 'name': name,
      if (baseUnit != null) 'base_unit': baseUnit,
      if (lastPrice != null) 'last_price': lastPrice,
      if (categoryCode != null) 'category_code': categoryCode,
      if (barcode != null) 'barcode': barcode,
    });
  }

  ItemsCompanion copyWith({
    Value<int>? id,
    Value<String>? code,
    Value<String>? name,
    Value<String?>? baseUnit,
    Value<double?>? lastPrice,
    Value<String?>? categoryCode,
    Value<String?>? barcode,
  }) {
    return ItemsCompanion(
      id: id ?? this.id,
      code: code ?? this.code,
      name: name ?? this.name,
      baseUnit: baseUnit ?? this.baseUnit,
      lastPrice: lastPrice ?? this.lastPrice,
      categoryCode: categoryCode ?? this.categoryCode,
      barcode: barcode ?? this.barcode,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (baseUnit.present) {
      map['base_unit'] = Variable<String>(baseUnit.value);
    }
    if (lastPrice.present) {
      map['last_price'] = Variable<double>(lastPrice.value);
    }
    if (categoryCode.present) {
      map['category_code'] = Variable<String>(categoryCode.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ItemsCompanion(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('baseUnit: $baseUnit, ')
          ..write('lastPrice: $lastPrice, ')
          ..write('categoryCode: $categoryCode, ')
          ..write('barcode: $barcode')
          ..write(')'))
        .toString();
  }
}

class $ItemUnitsTable extends ItemUnits
    with TableInfo<$ItemUnitsTable, ItemUnit> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ItemUnitsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _itemIdMeta = const VerificationMeta('itemId');
  @override
  late final GeneratedColumn<int> itemId = GeneratedColumn<int>(
    'item_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitIdMeta = const VerificationMeta('unitId');
  @override
  late final GeneratedColumn<int> unitId = GeneratedColumn<int>(
    'unit_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitCodeMeta = const VerificationMeta(
    'unitCode',
  );
  @override
  late final GeneratedColumn<String> unitCode = GeneratedColumn<String>(
    'unit_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _factorToBaseMeta = const VerificationMeta(
    'factorToBase',
  );
  @override
  late final GeneratedColumn<double> factorToBase = GeneratedColumn<double>(
    'factor_to_base',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _allowDecimalMeta = const VerificationMeta(
    'allowDecimal',
  );
  @override
  late final GeneratedColumn<bool> allowDecimal = GeneratedColumn<bool>(
    'allow_decimal',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("allow_decimal" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _barcodeMeta = const VerificationMeta(
    'barcode',
  );
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
    'barcode',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isSaleMeta = const VerificationMeta('isSale');
  @override
  late final GeneratedColumn<bool> isSale = GeneratedColumn<bool>(
    'is_sale',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_sale" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  static const VerificationMeta _isPurchaseMeta = const VerificationMeta(
    'isPurchase',
  );
  @override
  late final GeneratedColumn<bool> isPurchase = GeneratedColumn<bool>(
    'is_purchase',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_purchase" IN (0, 1))',
    ),
    defaultValue: const Constant(true),
  );
  @override
  List<GeneratedColumn> get $columns => [
    itemId,
    unitId,
    unitCode,
    factorToBase,
    allowDecimal,
    barcode,
    isSale,
    isPurchase,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'item_units';
  @override
  VerificationContext validateIntegrity(
    Insertable<ItemUnit> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('item_id')) {
      context.handle(
        _itemIdMeta,
        itemId.isAcceptableOrUnknown(data['item_id']!, _itemIdMeta),
      );
    } else if (isInserting) {
      context.missing(_itemIdMeta);
    }
    if (data.containsKey('unit_id')) {
      context.handle(
        _unitIdMeta,
        unitId.isAcceptableOrUnknown(data['unit_id']!, _unitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_unitIdMeta);
    }
    if (data.containsKey('unit_code')) {
      context.handle(
        _unitCodeMeta,
        unitCode.isAcceptableOrUnknown(data['unit_code']!, _unitCodeMeta),
      );
    }
    if (data.containsKey('factor_to_base')) {
      context.handle(
        _factorToBaseMeta,
        factorToBase.isAcceptableOrUnknown(
          data['factor_to_base']!,
          _factorToBaseMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_factorToBaseMeta);
    }
    if (data.containsKey('allow_decimal')) {
      context.handle(
        _allowDecimalMeta,
        allowDecimal.isAcceptableOrUnknown(
          data['allow_decimal']!,
          _allowDecimalMeta,
        ),
      );
    }
    if (data.containsKey('barcode')) {
      context.handle(
        _barcodeMeta,
        barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta),
      );
    }
    if (data.containsKey('is_sale')) {
      context.handle(
        _isSaleMeta,
        isSale.isAcceptableOrUnknown(data['is_sale']!, _isSaleMeta),
      );
    }
    if (data.containsKey('is_purchase')) {
      context.handle(
        _isPurchaseMeta,
        isPurchase.isAcceptableOrUnknown(data['is_purchase']!, _isPurchaseMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {itemId, unitId};
  @override
  ItemUnit map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ItemUnit(
      itemId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}item_id'],
      )!,
      unitId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_id'],
      )!,
      unitCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit_code'],
      ),
      factorToBase: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}factor_to_base'],
      )!,
      allowDecimal: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}allow_decimal'],
      )!,
      barcode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}barcode'],
      ),
      isSale: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_sale'],
      )!,
      isPurchase: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_purchase'],
      )!,
    );
  }

  @override
  $ItemUnitsTable createAlias(String alias) {
    return $ItemUnitsTable(attachedDatabase, alias);
  }
}

class ItemUnit extends DataClass implements Insertable<ItemUnit> {
  final int itemId;
  final int unitId;
  final String? unitCode;
  final double factorToBase;
  final bool allowDecimal;
  final String? barcode;
  final bool isSale;
  final bool isPurchase;
  const ItemUnit({
    required this.itemId,
    required this.unitId,
    this.unitCode,
    required this.factorToBase,
    required this.allowDecimal,
    this.barcode,
    required this.isSale,
    required this.isPurchase,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['item_id'] = Variable<int>(itemId);
    map['unit_id'] = Variable<int>(unitId);
    if (!nullToAbsent || unitCode != null) {
      map['unit_code'] = Variable<String>(unitCode);
    }
    map['factor_to_base'] = Variable<double>(factorToBase);
    map['allow_decimal'] = Variable<bool>(allowDecimal);
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    map['is_sale'] = Variable<bool>(isSale);
    map['is_purchase'] = Variable<bool>(isPurchase);
    return map;
  }

  ItemUnitsCompanion toCompanion(bool nullToAbsent) {
    return ItemUnitsCompanion(
      itemId: Value(itemId),
      unitId: Value(unitId),
      unitCode: unitCode == null && nullToAbsent
          ? const Value.absent()
          : Value(unitCode),
      factorToBase: Value(factorToBase),
      allowDecimal: Value(allowDecimal),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
      isSale: Value(isSale),
      isPurchase: Value(isPurchase),
    );
  }

  factory ItemUnit.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ItemUnit(
      itemId: serializer.fromJson<int>(json['itemId']),
      unitId: serializer.fromJson<int>(json['unitId']),
      unitCode: serializer.fromJson<String?>(json['unitCode']),
      factorToBase: serializer.fromJson<double>(json['factorToBase']),
      allowDecimal: serializer.fromJson<bool>(json['allowDecimal']),
      barcode: serializer.fromJson<String?>(json['barcode']),
      isSale: serializer.fromJson<bool>(json['isSale']),
      isPurchase: serializer.fromJson<bool>(json['isPurchase']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'itemId': serializer.toJson<int>(itemId),
      'unitId': serializer.toJson<int>(unitId),
      'unitCode': serializer.toJson<String?>(unitCode),
      'factorToBase': serializer.toJson<double>(factorToBase),
      'allowDecimal': serializer.toJson<bool>(allowDecimal),
      'barcode': serializer.toJson<String?>(barcode),
      'isSale': serializer.toJson<bool>(isSale),
      'isPurchase': serializer.toJson<bool>(isPurchase),
    };
  }

  ItemUnit copyWith({
    int? itemId,
    int? unitId,
    Value<String?> unitCode = const Value.absent(),
    double? factorToBase,
    bool? allowDecimal,
    Value<String?> barcode = const Value.absent(),
    bool? isSale,
    bool? isPurchase,
  }) => ItemUnit(
    itemId: itemId ?? this.itemId,
    unitId: unitId ?? this.unitId,
    unitCode: unitCode.present ? unitCode.value : this.unitCode,
    factorToBase: factorToBase ?? this.factorToBase,
    allowDecimal: allowDecimal ?? this.allowDecimal,
    barcode: barcode.present ? barcode.value : this.barcode,
    isSale: isSale ?? this.isSale,
    isPurchase: isPurchase ?? this.isPurchase,
  );
  ItemUnit copyWithCompanion(ItemUnitsCompanion data) {
    return ItemUnit(
      itemId: data.itemId.present ? data.itemId.value : this.itemId,
      unitId: data.unitId.present ? data.unitId.value : this.unitId,
      unitCode: data.unitCode.present ? data.unitCode.value : this.unitCode,
      factorToBase: data.factorToBase.present
          ? data.factorToBase.value
          : this.factorToBase,
      allowDecimal: data.allowDecimal.present
          ? data.allowDecimal.value
          : this.allowDecimal,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      isSale: data.isSale.present ? data.isSale.value : this.isSale,
      isPurchase: data.isPurchase.present
          ? data.isPurchase.value
          : this.isPurchase,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ItemUnit(')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('unitCode: $unitCode, ')
          ..write('factorToBase: $factorToBase, ')
          ..write('allowDecimal: $allowDecimal, ')
          ..write('barcode: $barcode, ')
          ..write('isSale: $isSale, ')
          ..write('isPurchase: $isPurchase')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    itemId,
    unitId,
    unitCode,
    factorToBase,
    allowDecimal,
    barcode,
    isSale,
    isPurchase,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ItemUnit &&
          other.itemId == this.itemId &&
          other.unitId == this.unitId &&
          other.unitCode == this.unitCode &&
          other.factorToBase == this.factorToBase &&
          other.allowDecimal == this.allowDecimal &&
          other.barcode == this.barcode &&
          other.isSale == this.isSale &&
          other.isPurchase == this.isPurchase);
}

class ItemUnitsCompanion extends UpdateCompanion<ItemUnit> {
  final Value<int> itemId;
  final Value<int> unitId;
  final Value<String?> unitCode;
  final Value<double> factorToBase;
  final Value<bool> allowDecimal;
  final Value<String?> barcode;
  final Value<bool> isSale;
  final Value<bool> isPurchase;
  final Value<int> rowid;
  const ItemUnitsCompanion({
    this.itemId = const Value.absent(),
    this.unitId = const Value.absent(),
    this.unitCode = const Value.absent(),
    this.factorToBase = const Value.absent(),
    this.allowDecimal = const Value.absent(),
    this.barcode = const Value.absent(),
    this.isSale = const Value.absent(),
    this.isPurchase = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ItemUnitsCompanion.insert({
    required int itemId,
    required int unitId,
    this.unitCode = const Value.absent(),
    required double factorToBase,
    this.allowDecimal = const Value.absent(),
    this.barcode = const Value.absent(),
    this.isSale = const Value.absent(),
    this.isPurchase = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : itemId = Value(itemId),
       unitId = Value(unitId),
       factorToBase = Value(factorToBase);
  static Insertable<ItemUnit> custom({
    Expression<int>? itemId,
    Expression<int>? unitId,
    Expression<String>? unitCode,
    Expression<double>? factorToBase,
    Expression<bool>? allowDecimal,
    Expression<String>? barcode,
    Expression<bool>? isSale,
    Expression<bool>? isPurchase,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (itemId != null) 'item_id': itemId,
      if (unitId != null) 'unit_id': unitId,
      if (unitCode != null) 'unit_code': unitCode,
      if (factorToBase != null) 'factor_to_base': factorToBase,
      if (allowDecimal != null) 'allow_decimal': allowDecimal,
      if (barcode != null) 'barcode': barcode,
      if (isSale != null) 'is_sale': isSale,
      if (isPurchase != null) 'is_purchase': isPurchase,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ItemUnitsCompanion copyWith({
    Value<int>? itemId,
    Value<int>? unitId,
    Value<String?>? unitCode,
    Value<double>? factorToBase,
    Value<bool>? allowDecimal,
    Value<String?>? barcode,
    Value<bool>? isSale,
    Value<bool>? isPurchase,
    Value<int>? rowid,
  }) {
    return ItemUnitsCompanion(
      itemId: itemId ?? this.itemId,
      unitId: unitId ?? this.unitId,
      unitCode: unitCode ?? this.unitCode,
      factorToBase: factorToBase ?? this.factorToBase,
      allowDecimal: allowDecimal ?? this.allowDecimal,
      barcode: barcode ?? this.barcode,
      isSale: isSale ?? this.isSale,
      isPurchase: isPurchase ?? this.isPurchase,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (itemId.present) {
      map['item_id'] = Variable<int>(itemId.value);
    }
    if (unitId.present) {
      map['unit_id'] = Variable<int>(unitId.value);
    }
    if (unitCode.present) {
      map['unit_code'] = Variable<String>(unitCode.value);
    }
    if (factorToBase.present) {
      map['factor_to_base'] = Variable<double>(factorToBase.value);
    }
    if (allowDecimal.present) {
      map['allow_decimal'] = Variable<bool>(allowDecimal.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (isSale.present) {
      map['is_sale'] = Variable<bool>(isSale.value);
    }
    if (isPurchase.present) {
      map['is_purchase'] = Variable<bool>(isPurchase.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ItemUnitsCompanion(')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('unitCode: $unitCode, ')
          ..write('factorToBase: $factorToBase, ')
          ..write('allowDecimal: $allowDecimal, ')
          ..write('barcode: $barcode, ')
          ..write('isSale: $isSale, ')
          ..write('isPurchase: $isPurchase, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CustomersTable extends Customers
    with TableInfo<$CustomersTable, Customer> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CustomersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
    'code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _phoneMeta = const VerificationMeta('phone');
  @override
  late final GeneratedColumn<String> phone = GeneratedColumn<String>(
    'phone',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _balanceMeta = const VerificationMeta(
    'balance',
  );
  @override
  late final GeneratedColumn<double> balance = GeneratedColumn<double>(
    'balance',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _latMeta = const VerificationMeta('lat');
  @override
  late final GeneratedColumn<double> lat = GeneratedColumn<double>(
    'lat',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lngMeta = const VerificationMeta('lng');
  @override
  late final GeneratedColumn<double> lng = GeneratedColumn<double>(
    'lng',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _priceListIdMeta = const VerificationMeta(
    'priceListId',
  );
  @override
  late final GeneratedColumn<int> priceListId = GeneratedColumn<int>(
    'price_list_id',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastStatementJsonMeta = const VerificationMeta(
    'lastStatementJson',
  );
  @override
  late final GeneratedColumn<String> lastStatementJson =
      GeneratedColumn<String>(
        'last_statement_json',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    code,
    name,
    phone,
    balance,
    lat,
    lng,
    priceListId,
    lastStatementJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'customers';
  @override
  VerificationContext validateIntegrity(
    Insertable<Customer> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('code')) {
      context.handle(
        _codeMeta,
        code.isAcceptableOrUnknown(data['code']!, _codeMeta),
      );
    } else if (isInserting) {
      context.missing(_codeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('phone')) {
      context.handle(
        _phoneMeta,
        phone.isAcceptableOrUnknown(data['phone']!, _phoneMeta),
      );
    }
    if (data.containsKey('balance')) {
      context.handle(
        _balanceMeta,
        balance.isAcceptableOrUnknown(data['balance']!, _balanceMeta),
      );
    }
    if (data.containsKey('lat')) {
      context.handle(
        _latMeta,
        lat.isAcceptableOrUnknown(data['lat']!, _latMeta),
      );
    }
    if (data.containsKey('lng')) {
      context.handle(
        _lngMeta,
        lng.isAcceptableOrUnknown(data['lng']!, _lngMeta),
      );
    }
    if (data.containsKey('price_list_id')) {
      context.handle(
        _priceListIdMeta,
        priceListId.isAcceptableOrUnknown(
          data['price_list_id']!,
          _priceListIdMeta,
        ),
      );
    }
    if (data.containsKey('last_statement_json')) {
      context.handle(
        _lastStatementJsonMeta,
        lastStatementJson.isAcceptableOrUnknown(
          data['last_statement_json']!,
          _lastStatementJsonMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  Customer map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return Customer(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      code: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}code'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      phone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phone'],
      ),
      balance: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}balance'],
      )!,
      lat: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}lat'],
      ),
      lng: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}lng'],
      ),
      priceListId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}price_list_id'],
      ),
      lastStatementJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_statement_json'],
      ),
    );
  }

  @override
  $CustomersTable createAlias(String alias) {
    return $CustomersTable(attachedDatabase, alias);
  }
}

class Customer extends DataClass implements Insertable<Customer> {
  final int id;
  final String code;
  final String name;
  final String? phone;
  final double balance;
  final double? lat;
  final double? lng;
  final int? priceListId;
  final String? lastStatementJson;
  const Customer({
    required this.id,
    required this.code,
    required this.name,
    this.phone,
    required this.balance,
    this.lat,
    this.lng,
    this.priceListId,
    this.lastStatementJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['code'] = Variable<String>(code);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || phone != null) {
      map['phone'] = Variable<String>(phone);
    }
    map['balance'] = Variable<double>(balance);
    if (!nullToAbsent || lat != null) {
      map['lat'] = Variable<double>(lat);
    }
    if (!nullToAbsent || lng != null) {
      map['lng'] = Variable<double>(lng);
    }
    if (!nullToAbsent || priceListId != null) {
      map['price_list_id'] = Variable<int>(priceListId);
    }
    if (!nullToAbsent || lastStatementJson != null) {
      map['last_statement_json'] = Variable<String>(lastStatementJson);
    }
    return map;
  }

  CustomersCompanion toCompanion(bool nullToAbsent) {
    return CustomersCompanion(
      id: Value(id),
      code: Value(code),
      name: Value(name),
      phone: phone == null && nullToAbsent
          ? const Value.absent()
          : Value(phone),
      balance: Value(balance),
      lat: lat == null && nullToAbsent ? const Value.absent() : Value(lat),
      lng: lng == null && nullToAbsent ? const Value.absent() : Value(lng),
      priceListId: priceListId == null && nullToAbsent
          ? const Value.absent()
          : Value(priceListId),
      lastStatementJson: lastStatementJson == null && nullToAbsent
          ? const Value.absent()
          : Value(lastStatementJson),
    );
  }

  factory Customer.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return Customer(
      id: serializer.fromJson<int>(json['id']),
      code: serializer.fromJson<String>(json['code']),
      name: serializer.fromJson<String>(json['name']),
      phone: serializer.fromJson<String?>(json['phone']),
      balance: serializer.fromJson<double>(json['balance']),
      lat: serializer.fromJson<double?>(json['lat']),
      lng: serializer.fromJson<double?>(json['lng']),
      priceListId: serializer.fromJson<int?>(json['priceListId']),
      lastStatementJson: serializer.fromJson<String?>(
        json['lastStatementJson'],
      ),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'code': serializer.toJson<String>(code),
      'name': serializer.toJson<String>(name),
      'phone': serializer.toJson<String?>(phone),
      'balance': serializer.toJson<double>(balance),
      'lat': serializer.toJson<double?>(lat),
      'lng': serializer.toJson<double?>(lng),
      'priceListId': serializer.toJson<int?>(priceListId),
      'lastStatementJson': serializer.toJson<String?>(lastStatementJson),
    };
  }

  Customer copyWith({
    int? id,
    String? code,
    String? name,
    Value<String?> phone = const Value.absent(),
    double? balance,
    Value<double?> lat = const Value.absent(),
    Value<double?> lng = const Value.absent(),
    Value<int?> priceListId = const Value.absent(),
    Value<String?> lastStatementJson = const Value.absent(),
  }) => Customer(
    id: id ?? this.id,
    code: code ?? this.code,
    name: name ?? this.name,
    phone: phone.present ? phone.value : this.phone,
    balance: balance ?? this.balance,
    lat: lat.present ? lat.value : this.lat,
    lng: lng.present ? lng.value : this.lng,
    priceListId: priceListId.present ? priceListId.value : this.priceListId,
    lastStatementJson: lastStatementJson.present
        ? lastStatementJson.value
        : this.lastStatementJson,
  );
  Customer copyWithCompanion(CustomersCompanion data) {
    return Customer(
      id: data.id.present ? data.id.value : this.id,
      code: data.code.present ? data.code.value : this.code,
      name: data.name.present ? data.name.value : this.name,
      phone: data.phone.present ? data.phone.value : this.phone,
      balance: data.balance.present ? data.balance.value : this.balance,
      lat: data.lat.present ? data.lat.value : this.lat,
      lng: data.lng.present ? data.lng.value : this.lng,
      priceListId: data.priceListId.present
          ? data.priceListId.value
          : this.priceListId,
      lastStatementJson: data.lastStatementJson.present
          ? data.lastStatementJson.value
          : this.lastStatementJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('Customer(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('balance: $balance, ')
          ..write('lat: $lat, ')
          ..write('lng: $lng, ')
          ..write('priceListId: $priceListId, ')
          ..write('lastStatementJson: $lastStatementJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    code,
    name,
    phone,
    balance,
    lat,
    lng,
    priceListId,
    lastStatementJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is Customer &&
          other.id == this.id &&
          other.code == this.code &&
          other.name == this.name &&
          other.phone == this.phone &&
          other.balance == this.balance &&
          other.lat == this.lat &&
          other.lng == this.lng &&
          other.priceListId == this.priceListId &&
          other.lastStatementJson == this.lastStatementJson);
}

class CustomersCompanion extends UpdateCompanion<Customer> {
  final Value<int> id;
  final Value<String> code;
  final Value<String> name;
  final Value<String?> phone;
  final Value<double> balance;
  final Value<double?> lat;
  final Value<double?> lng;
  final Value<int?> priceListId;
  final Value<String?> lastStatementJson;
  const CustomersCompanion({
    this.id = const Value.absent(),
    this.code = const Value.absent(),
    this.name = const Value.absent(),
    this.phone = const Value.absent(),
    this.balance = const Value.absent(),
    this.lat = const Value.absent(),
    this.lng = const Value.absent(),
    this.priceListId = const Value.absent(),
    this.lastStatementJson = const Value.absent(),
  });
  CustomersCompanion.insert({
    this.id = const Value.absent(),
    required String code,
    required String name,
    this.phone = const Value.absent(),
    this.balance = const Value.absent(),
    this.lat = const Value.absent(),
    this.lng = const Value.absent(),
    this.priceListId = const Value.absent(),
    this.lastStatementJson = const Value.absent(),
  }) : code = Value(code),
       name = Value(name);
  static Insertable<Customer> custom({
    Expression<int>? id,
    Expression<String>? code,
    Expression<String>? name,
    Expression<String>? phone,
    Expression<double>? balance,
    Expression<double>? lat,
    Expression<double>? lng,
    Expression<int>? priceListId,
    Expression<String>? lastStatementJson,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (code != null) 'code': code,
      if (name != null) 'name': name,
      if (phone != null) 'phone': phone,
      if (balance != null) 'balance': balance,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (priceListId != null) 'price_list_id': priceListId,
      if (lastStatementJson != null) 'last_statement_json': lastStatementJson,
    });
  }

  CustomersCompanion copyWith({
    Value<int>? id,
    Value<String>? code,
    Value<String>? name,
    Value<String?>? phone,
    Value<double>? balance,
    Value<double?>? lat,
    Value<double?>? lng,
    Value<int?>? priceListId,
    Value<String?>? lastStatementJson,
  }) {
    return CustomersCompanion(
      id: id ?? this.id,
      code: code ?? this.code,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      balance: balance ?? this.balance,
      lat: lat ?? this.lat,
      lng: lng ?? this.lng,
      priceListId: priceListId ?? this.priceListId,
      lastStatementJson: lastStatementJson ?? this.lastStatementJson,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (phone.present) {
      map['phone'] = Variable<String>(phone.value);
    }
    if (balance.present) {
      map['balance'] = Variable<double>(balance.value);
    }
    if (lat.present) {
      map['lat'] = Variable<double>(lat.value);
    }
    if (lng.present) {
      map['lng'] = Variable<double>(lng.value);
    }
    if (priceListId.present) {
      map['price_list_id'] = Variable<int>(priceListId.value);
    }
    if (lastStatementJson.present) {
      map['last_statement_json'] = Variable<String>(lastStatementJson.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CustomersCompanion(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('balance: $balance, ')
          ..write('lat: $lat, ')
          ..write('lng: $lng, ')
          ..write('priceListId: $priceListId, ')
          ..write('lastStatementJson: $lastStatementJson')
          ..write(')'))
        .toString();
  }
}

class $PriceListsTable extends PriceLists
    with TableInfo<$PriceListsTable, PriceList> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PriceListsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
    'code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, code, name];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'price_lists';
  @override
  VerificationContext validateIntegrity(
    Insertable<PriceList> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('code')) {
      context.handle(
        _codeMeta,
        code.isAcceptableOrUnknown(data['code']!, _codeMeta),
      );
    } else if (isInserting) {
      context.missing(_codeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PriceList map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PriceList(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      code: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}code'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
    );
  }

  @override
  $PriceListsTable createAlias(String alias) {
    return $PriceListsTable(attachedDatabase, alias);
  }
}

class PriceList extends DataClass implements Insertable<PriceList> {
  final int id;
  final String code;
  final String name;
  const PriceList({required this.id, required this.code, required this.name});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['code'] = Variable<String>(code);
    map['name'] = Variable<String>(name);
    return map;
  }

  PriceListsCompanion toCompanion(bool nullToAbsent) {
    return PriceListsCompanion(
      id: Value(id),
      code: Value(code),
      name: Value(name),
    );
  }

  factory PriceList.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PriceList(
      id: serializer.fromJson<int>(json['id']),
      code: serializer.fromJson<String>(json['code']),
      name: serializer.fromJson<String>(json['name']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'code': serializer.toJson<String>(code),
      'name': serializer.toJson<String>(name),
    };
  }

  PriceList copyWith({int? id, String? code, String? name}) => PriceList(
    id: id ?? this.id,
    code: code ?? this.code,
    name: name ?? this.name,
  );
  PriceList copyWithCompanion(PriceListsCompanion data) {
    return PriceList(
      id: data.id.present ? data.id.value : this.id,
      code: data.code.present ? data.code.value : this.code,
      name: data.name.present ? data.name.value : this.name,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PriceList(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, code, name);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PriceList &&
          other.id == this.id &&
          other.code == this.code &&
          other.name == this.name);
}

class PriceListsCompanion extends UpdateCompanion<PriceList> {
  final Value<int> id;
  final Value<String> code;
  final Value<String> name;
  const PriceListsCompanion({
    this.id = const Value.absent(),
    this.code = const Value.absent(),
    this.name = const Value.absent(),
  });
  PriceListsCompanion.insert({
    this.id = const Value.absent(),
    required String code,
    required String name,
  }) : code = Value(code),
       name = Value(name);
  static Insertable<PriceList> custom({
    Expression<int>? id,
    Expression<String>? code,
    Expression<String>? name,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (code != null) 'code': code,
      if (name != null) 'name': name,
    });
  }

  PriceListsCompanion copyWith({
    Value<int>? id,
    Value<String>? code,
    Value<String>? name,
  }) {
    return PriceListsCompanion(
      id: id ?? this.id,
      code: code ?? this.code,
      name: name ?? this.name,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PriceListsCompanion(')
          ..write('id: $id, ')
          ..write('code: $code, ')
          ..write('name: $name')
          ..write(')'))
        .toString();
  }
}

class $ItemPricesTable extends ItemPrices
    with TableInfo<$ItemPricesTable, ItemPrice> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ItemPricesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _priceListIdMeta = const VerificationMeta(
    'priceListId',
  );
  @override
  late final GeneratedColumn<int> priceListId = GeneratedColumn<int>(
    'price_list_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _itemIdMeta = const VerificationMeta('itemId');
  @override
  late final GeneratedColumn<int> itemId = GeneratedColumn<int>(
    'item_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitIdMeta = const VerificationMeta('unitId');
  @override
  late final GeneratedColumn<int> unitId = GeneratedColumn<int>(
    'unit_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _priceMeta = const VerificationMeta('price');
  @override
  late final GeneratedColumn<double> price = GeneratedColumn<double>(
    'price',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    priceListId,
    itemId,
    unitId,
    price,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'item_prices';
  @override
  VerificationContext validateIntegrity(
    Insertable<ItemPrice> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('price_list_id')) {
      context.handle(
        _priceListIdMeta,
        priceListId.isAcceptableOrUnknown(
          data['price_list_id']!,
          _priceListIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_priceListIdMeta);
    }
    if (data.containsKey('item_id')) {
      context.handle(
        _itemIdMeta,
        itemId.isAcceptableOrUnknown(data['item_id']!, _itemIdMeta),
      );
    } else if (isInserting) {
      context.missing(_itemIdMeta);
    }
    if (data.containsKey('unit_id')) {
      context.handle(
        _unitIdMeta,
        unitId.isAcceptableOrUnknown(data['unit_id']!, _unitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_unitIdMeta);
    }
    if (data.containsKey('price')) {
      context.handle(
        _priceMeta,
        price.isAcceptableOrUnknown(data['price']!, _priceMeta),
      );
    } else if (isInserting) {
      context.missing(_priceMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {priceListId, itemId, unitId},
  ];
  @override
  ItemPrice map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ItemPrice(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      priceListId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}price_list_id'],
      )!,
      itemId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}item_id'],
      )!,
      unitId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_id'],
      )!,
      price: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}price'],
      )!,
    );
  }

  @override
  $ItemPricesTable createAlias(String alias) {
    return $ItemPricesTable(attachedDatabase, alias);
  }
}

class ItemPrice extends DataClass implements Insertable<ItemPrice> {
  final int id;
  final int priceListId;
  final int itemId;
  final int unitId;
  final double price;
  const ItemPrice({
    required this.id,
    required this.priceListId,
    required this.itemId,
    required this.unitId,
    required this.price,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['price_list_id'] = Variable<int>(priceListId);
    map['item_id'] = Variable<int>(itemId);
    map['unit_id'] = Variable<int>(unitId);
    map['price'] = Variable<double>(price);
    return map;
  }

  ItemPricesCompanion toCompanion(bool nullToAbsent) {
    return ItemPricesCompanion(
      id: Value(id),
      priceListId: Value(priceListId),
      itemId: Value(itemId),
      unitId: Value(unitId),
      price: Value(price),
    );
  }

  factory ItemPrice.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ItemPrice(
      id: serializer.fromJson<int>(json['id']),
      priceListId: serializer.fromJson<int>(json['priceListId']),
      itemId: serializer.fromJson<int>(json['itemId']),
      unitId: serializer.fromJson<int>(json['unitId']),
      price: serializer.fromJson<double>(json['price']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'priceListId': serializer.toJson<int>(priceListId),
      'itemId': serializer.toJson<int>(itemId),
      'unitId': serializer.toJson<int>(unitId),
      'price': serializer.toJson<double>(price),
    };
  }

  ItemPrice copyWith({
    int? id,
    int? priceListId,
    int? itemId,
    int? unitId,
    double? price,
  }) => ItemPrice(
    id: id ?? this.id,
    priceListId: priceListId ?? this.priceListId,
    itemId: itemId ?? this.itemId,
    unitId: unitId ?? this.unitId,
    price: price ?? this.price,
  );
  ItemPrice copyWithCompanion(ItemPricesCompanion data) {
    return ItemPrice(
      id: data.id.present ? data.id.value : this.id,
      priceListId: data.priceListId.present
          ? data.priceListId.value
          : this.priceListId,
      itemId: data.itemId.present ? data.itemId.value : this.itemId,
      unitId: data.unitId.present ? data.unitId.value : this.unitId,
      price: data.price.present ? data.price.value : this.price,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ItemPrice(')
          ..write('id: $id, ')
          ..write('priceListId: $priceListId, ')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('price: $price')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, priceListId, itemId, unitId, price);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ItemPrice &&
          other.id == this.id &&
          other.priceListId == this.priceListId &&
          other.itemId == this.itemId &&
          other.unitId == this.unitId &&
          other.price == this.price);
}

class ItemPricesCompanion extends UpdateCompanion<ItemPrice> {
  final Value<int> id;
  final Value<int> priceListId;
  final Value<int> itemId;
  final Value<int> unitId;
  final Value<double> price;
  const ItemPricesCompanion({
    this.id = const Value.absent(),
    this.priceListId = const Value.absent(),
    this.itemId = const Value.absent(),
    this.unitId = const Value.absent(),
    this.price = const Value.absent(),
  });
  ItemPricesCompanion.insert({
    this.id = const Value.absent(),
    required int priceListId,
    required int itemId,
    required int unitId,
    required double price,
  }) : priceListId = Value(priceListId),
       itemId = Value(itemId),
       unitId = Value(unitId),
       price = Value(price);
  static Insertable<ItemPrice> custom({
    Expression<int>? id,
    Expression<int>? priceListId,
    Expression<int>? itemId,
    Expression<int>? unitId,
    Expression<double>? price,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (priceListId != null) 'price_list_id': priceListId,
      if (itemId != null) 'item_id': itemId,
      if (unitId != null) 'unit_id': unitId,
      if (price != null) 'price': price,
    });
  }

  ItemPricesCompanion copyWith({
    Value<int>? id,
    Value<int>? priceListId,
    Value<int>? itemId,
    Value<int>? unitId,
    Value<double>? price,
  }) {
    return ItemPricesCompanion(
      id: id ?? this.id,
      priceListId: priceListId ?? this.priceListId,
      itemId: itemId ?? this.itemId,
      unitId: unitId ?? this.unitId,
      price: price ?? this.price,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (priceListId.present) {
      map['price_list_id'] = Variable<int>(priceListId.value);
    }
    if (itemId.present) {
      map['item_id'] = Variable<int>(itemId.value);
    }
    if (unitId.present) {
      map['unit_id'] = Variable<int>(unitId.value);
    }
    if (price.present) {
      map['price'] = Variable<double>(price.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ItemPricesCompanion(')
          ..write('id: $id, ')
          ..write('priceListId: $priceListId, ')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('price: $price')
          ..write(')'))
        .toString();
  }
}

class $StatementRowsTable extends StatementRows
    with TableInfo<$StatementRowsTable, StatementRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StatementRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _numberMeta = const VerificationMeta('number');
  @override
  late final GeneratedColumn<String> number = GeneratedColumn<String>(
    'number',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _customerIdMeta = const VerificationMeta(
    'customerId',
  );
  @override
  late final GeneratedColumn<int> customerId = GeneratedColumn<int>(
    'customer_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
    'date',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _netMeta = const VerificationMeta('net');
  @override
  late final GeneratedColumn<double> net = GeneratedColumn<double>(
    'net',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    number,
    customerId,
    date,
    status,
    net,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'statement_rows';
  @override
  VerificationContext validateIntegrity(
    Insertable<StatementRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('number')) {
      context.handle(
        _numberMeta,
        number.isAcceptableOrUnknown(data['number']!, _numberMeta),
      );
    } else if (isInserting) {
      context.missing(_numberMeta);
    }
    if (data.containsKey('customer_id')) {
      context.handle(
        _customerIdMeta,
        customerId.isAcceptableOrUnknown(data['customer_id']!, _customerIdMeta),
      );
    } else if (isInserting) {
      context.missing(_customerIdMeta);
    }
    if (data.containsKey('date')) {
      context.handle(
        _dateMeta,
        date.isAcceptableOrUnknown(data['date']!, _dateMeta),
      );
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('net')) {
      context.handle(
        _netMeta,
        net.isAcceptableOrUnknown(data['net']!, _netMeta),
      );
    } else if (isInserting) {
      context.missing(_netMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StatementRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StatementRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      number: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}number'],
      )!,
      customerId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}customer_id'],
      )!,
      date: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}date'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      net: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}net'],
      )!,
    );
  }

  @override
  $StatementRowsTable createAlias(String alias) {
    return $StatementRowsTable(attachedDatabase, alias);
  }
}

class StatementRow extends DataClass implements Insertable<StatementRow> {
  final int id;
  final String number;
  final int customerId;
  final DateTime date;
  final String status;
  final double net;
  const StatementRow({
    required this.id,
    required this.number,
    required this.customerId,
    required this.date,
    required this.status,
    required this.net,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['number'] = Variable<String>(number);
    map['customer_id'] = Variable<int>(customerId);
    map['date'] = Variable<DateTime>(date);
    map['status'] = Variable<String>(status);
    map['net'] = Variable<double>(net);
    return map;
  }

  StatementRowsCompanion toCompanion(bool nullToAbsent) {
    return StatementRowsCompanion(
      id: Value(id),
      number: Value(number),
      customerId: Value(customerId),
      date: Value(date),
      status: Value(status),
      net: Value(net),
    );
  }

  factory StatementRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StatementRow(
      id: serializer.fromJson<int>(json['id']),
      number: serializer.fromJson<String>(json['number']),
      customerId: serializer.fromJson<int>(json['customerId']),
      date: serializer.fromJson<DateTime>(json['date']),
      status: serializer.fromJson<String>(json['status']),
      net: serializer.fromJson<double>(json['net']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'number': serializer.toJson<String>(number),
      'customerId': serializer.toJson<int>(customerId),
      'date': serializer.toJson<DateTime>(date),
      'status': serializer.toJson<String>(status),
      'net': serializer.toJson<double>(net),
    };
  }

  StatementRow copyWith({
    int? id,
    String? number,
    int? customerId,
    DateTime? date,
    String? status,
    double? net,
  }) => StatementRow(
    id: id ?? this.id,
    number: number ?? this.number,
    customerId: customerId ?? this.customerId,
    date: date ?? this.date,
    status: status ?? this.status,
    net: net ?? this.net,
  );
  StatementRow copyWithCompanion(StatementRowsCompanion data) {
    return StatementRow(
      id: data.id.present ? data.id.value : this.id,
      number: data.number.present ? data.number.value : this.number,
      customerId: data.customerId.present
          ? data.customerId.value
          : this.customerId,
      date: data.date.present ? data.date.value : this.date,
      status: data.status.present ? data.status.value : this.status,
      net: data.net.present ? data.net.value : this.net,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StatementRow(')
          ..write('id: $id, ')
          ..write('number: $number, ')
          ..write('customerId: $customerId, ')
          ..write('date: $date, ')
          ..write('status: $status, ')
          ..write('net: $net')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, number, customerId, date, status, net);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StatementRow &&
          other.id == this.id &&
          other.number == this.number &&
          other.customerId == this.customerId &&
          other.date == this.date &&
          other.status == this.status &&
          other.net == this.net);
}

class StatementRowsCompanion extends UpdateCompanion<StatementRow> {
  final Value<int> id;
  final Value<String> number;
  final Value<int> customerId;
  final Value<DateTime> date;
  final Value<String> status;
  final Value<double> net;
  const StatementRowsCompanion({
    this.id = const Value.absent(),
    this.number = const Value.absent(),
    this.customerId = const Value.absent(),
    this.date = const Value.absent(),
    this.status = const Value.absent(),
    this.net = const Value.absent(),
  });
  StatementRowsCompanion.insert({
    this.id = const Value.absent(),
    required String number,
    required int customerId,
    required DateTime date,
    required String status,
    required double net,
  }) : number = Value(number),
       customerId = Value(customerId),
       date = Value(date),
       status = Value(status),
       net = Value(net);
  static Insertable<StatementRow> custom({
    Expression<int>? id,
    Expression<String>? number,
    Expression<int>? customerId,
    Expression<DateTime>? date,
    Expression<String>? status,
    Expression<double>? net,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (number != null) 'number': number,
      if (customerId != null) 'customer_id': customerId,
      if (date != null) 'date': date,
      if (status != null) 'status': status,
      if (net != null) 'net': net,
    });
  }

  StatementRowsCompanion copyWith({
    Value<int>? id,
    Value<String>? number,
    Value<int>? customerId,
    Value<DateTime>? date,
    Value<String>? status,
    Value<double>? net,
  }) {
    return StatementRowsCompanion(
      id: id ?? this.id,
      number: number ?? this.number,
      customerId: customerId ?? this.customerId,
      date: date ?? this.date,
      status: status ?? this.status,
      net: net ?? this.net,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (number.present) {
      map['number'] = Variable<String>(number.value);
    }
    if (customerId.present) {
      map['customer_id'] = Variable<int>(customerId.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (net.present) {
      map['net'] = Variable<double>(net.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StatementRowsCompanion(')
          ..write('id: $id, ')
          ..write('number: $number, ')
          ..write('customerId: $customerId, ')
          ..write('date: $date, ')
          ..write('status: $status, ')
          ..write('net: $net')
          ..write(')'))
        .toString();
  }
}

class $StatementLineRowsTable extends StatementLineRows
    with TableInfo<$StatementLineRowsTable, StatementLineRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StatementLineRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statementIdMeta = const VerificationMeta(
    'statementId',
  );
  @override
  late final GeneratedColumn<int> statementId = GeneratedColumn<int>(
    'statement_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _itemIdMeta = const VerificationMeta('itemId');
  @override
  late final GeneratedColumn<int> itemId = GeneratedColumn<int>(
    'item_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitIdMeta = const VerificationMeta('unitId');
  @override
  late final GeneratedColumn<int> unitId = GeneratedColumn<int>(
    'unit_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _qtyMeta = const VerificationMeta('qty');
  @override
  late final GeneratedColumn<double> qty = GeneratedColumn<double>(
    'qty',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _qtyBaseMeta = const VerificationMeta(
    'qtyBase',
  );
  @override
  late final GeneratedColumn<double> qtyBase = GeneratedColumn<double>(
    'qty_base',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitPriceMeta = const VerificationMeta(
    'unitPrice',
  );
  @override
  late final GeneratedColumn<double> unitPrice = GeneratedColumn<double>(
    'unit_price',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _netLineMeta = const VerificationMeta(
    'netLine',
  );
  @override
  late final GeneratedColumn<double> netLine = GeneratedColumn<double>(
    'net_line',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    statementId,
    itemId,
    unitId,
    qty,
    qtyBase,
    unitPrice,
    netLine,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'statement_line_rows';
  @override
  VerificationContext validateIntegrity(
    Insertable<StatementLineRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('statement_id')) {
      context.handle(
        _statementIdMeta,
        statementId.isAcceptableOrUnknown(
          data['statement_id']!,
          _statementIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_statementIdMeta);
    }
    if (data.containsKey('item_id')) {
      context.handle(
        _itemIdMeta,
        itemId.isAcceptableOrUnknown(data['item_id']!, _itemIdMeta),
      );
    } else if (isInserting) {
      context.missing(_itemIdMeta);
    }
    if (data.containsKey('unit_id')) {
      context.handle(
        _unitIdMeta,
        unitId.isAcceptableOrUnknown(data['unit_id']!, _unitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_unitIdMeta);
    }
    if (data.containsKey('qty')) {
      context.handle(
        _qtyMeta,
        qty.isAcceptableOrUnknown(data['qty']!, _qtyMeta),
      );
    } else if (isInserting) {
      context.missing(_qtyMeta);
    }
    if (data.containsKey('qty_base')) {
      context.handle(
        _qtyBaseMeta,
        qtyBase.isAcceptableOrUnknown(data['qty_base']!, _qtyBaseMeta),
      );
    } else if (isInserting) {
      context.missing(_qtyBaseMeta);
    }
    if (data.containsKey('unit_price')) {
      context.handle(
        _unitPriceMeta,
        unitPrice.isAcceptableOrUnknown(data['unit_price']!, _unitPriceMeta),
      );
    } else if (isInserting) {
      context.missing(_unitPriceMeta);
    }
    if (data.containsKey('net_line')) {
      context.handle(
        _netLineMeta,
        netLine.isAcceptableOrUnknown(data['net_line']!, _netLineMeta),
      );
    } else if (isInserting) {
      context.missing(_netLineMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StatementLineRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StatementLineRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      statementId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}statement_id'],
      )!,
      itemId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}item_id'],
      )!,
      unitId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_id'],
      )!,
      qty: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}qty'],
      )!,
      qtyBase: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}qty_base'],
      )!,
      unitPrice: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}unit_price'],
      )!,
      netLine: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}net_line'],
      )!,
    );
  }

  @override
  $StatementLineRowsTable createAlias(String alias) {
    return $StatementLineRowsTable(attachedDatabase, alias);
  }
}

class StatementLineRow extends DataClass
    implements Insertable<StatementLineRow> {
  final int id;
  final int statementId;
  final int itemId;
  final int unitId;
  final double qty;
  final double qtyBase;
  final double unitPrice;
  final double netLine;
  const StatementLineRow({
    required this.id,
    required this.statementId,
    required this.itemId,
    required this.unitId,
    required this.qty,
    required this.qtyBase,
    required this.unitPrice,
    required this.netLine,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['statement_id'] = Variable<int>(statementId);
    map['item_id'] = Variable<int>(itemId);
    map['unit_id'] = Variable<int>(unitId);
    map['qty'] = Variable<double>(qty);
    map['qty_base'] = Variable<double>(qtyBase);
    map['unit_price'] = Variable<double>(unitPrice);
    map['net_line'] = Variable<double>(netLine);
    return map;
  }

  StatementLineRowsCompanion toCompanion(bool nullToAbsent) {
    return StatementLineRowsCompanion(
      id: Value(id),
      statementId: Value(statementId),
      itemId: Value(itemId),
      unitId: Value(unitId),
      qty: Value(qty),
      qtyBase: Value(qtyBase),
      unitPrice: Value(unitPrice),
      netLine: Value(netLine),
    );
  }

  factory StatementLineRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StatementLineRow(
      id: serializer.fromJson<int>(json['id']),
      statementId: serializer.fromJson<int>(json['statementId']),
      itemId: serializer.fromJson<int>(json['itemId']),
      unitId: serializer.fromJson<int>(json['unitId']),
      qty: serializer.fromJson<double>(json['qty']),
      qtyBase: serializer.fromJson<double>(json['qtyBase']),
      unitPrice: serializer.fromJson<double>(json['unitPrice']),
      netLine: serializer.fromJson<double>(json['netLine']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'statementId': serializer.toJson<int>(statementId),
      'itemId': serializer.toJson<int>(itemId),
      'unitId': serializer.toJson<int>(unitId),
      'qty': serializer.toJson<double>(qty),
      'qtyBase': serializer.toJson<double>(qtyBase),
      'unitPrice': serializer.toJson<double>(unitPrice),
      'netLine': serializer.toJson<double>(netLine),
    };
  }

  StatementLineRow copyWith({
    int? id,
    int? statementId,
    int? itemId,
    int? unitId,
    double? qty,
    double? qtyBase,
    double? unitPrice,
    double? netLine,
  }) => StatementLineRow(
    id: id ?? this.id,
    statementId: statementId ?? this.statementId,
    itemId: itemId ?? this.itemId,
    unitId: unitId ?? this.unitId,
    qty: qty ?? this.qty,
    qtyBase: qtyBase ?? this.qtyBase,
    unitPrice: unitPrice ?? this.unitPrice,
    netLine: netLine ?? this.netLine,
  );
  StatementLineRow copyWithCompanion(StatementLineRowsCompanion data) {
    return StatementLineRow(
      id: data.id.present ? data.id.value : this.id,
      statementId: data.statementId.present
          ? data.statementId.value
          : this.statementId,
      itemId: data.itemId.present ? data.itemId.value : this.itemId,
      unitId: data.unitId.present ? data.unitId.value : this.unitId,
      qty: data.qty.present ? data.qty.value : this.qty,
      qtyBase: data.qtyBase.present ? data.qtyBase.value : this.qtyBase,
      unitPrice: data.unitPrice.present ? data.unitPrice.value : this.unitPrice,
      netLine: data.netLine.present ? data.netLine.value : this.netLine,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StatementLineRow(')
          ..write('id: $id, ')
          ..write('statementId: $statementId, ')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('qty: $qty, ')
          ..write('qtyBase: $qtyBase, ')
          ..write('unitPrice: $unitPrice, ')
          ..write('netLine: $netLine')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    statementId,
    itemId,
    unitId,
    qty,
    qtyBase,
    unitPrice,
    netLine,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StatementLineRow &&
          other.id == this.id &&
          other.statementId == this.statementId &&
          other.itemId == this.itemId &&
          other.unitId == this.unitId &&
          other.qty == this.qty &&
          other.qtyBase == this.qtyBase &&
          other.unitPrice == this.unitPrice &&
          other.netLine == this.netLine);
}

class StatementLineRowsCompanion extends UpdateCompanion<StatementLineRow> {
  final Value<int> id;
  final Value<int> statementId;
  final Value<int> itemId;
  final Value<int> unitId;
  final Value<double> qty;
  final Value<double> qtyBase;
  final Value<double> unitPrice;
  final Value<double> netLine;
  const StatementLineRowsCompanion({
    this.id = const Value.absent(),
    this.statementId = const Value.absent(),
    this.itemId = const Value.absent(),
    this.unitId = const Value.absent(),
    this.qty = const Value.absent(),
    this.qtyBase = const Value.absent(),
    this.unitPrice = const Value.absent(),
    this.netLine = const Value.absent(),
  });
  StatementLineRowsCompanion.insert({
    this.id = const Value.absent(),
    required int statementId,
    required int itemId,
    required int unitId,
    required double qty,
    required double qtyBase,
    required double unitPrice,
    required double netLine,
  }) : statementId = Value(statementId),
       itemId = Value(itemId),
       unitId = Value(unitId),
       qty = Value(qty),
       qtyBase = Value(qtyBase),
       unitPrice = Value(unitPrice),
       netLine = Value(netLine);
  static Insertable<StatementLineRow> custom({
    Expression<int>? id,
    Expression<int>? statementId,
    Expression<int>? itemId,
    Expression<int>? unitId,
    Expression<double>? qty,
    Expression<double>? qtyBase,
    Expression<double>? unitPrice,
    Expression<double>? netLine,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (statementId != null) 'statement_id': statementId,
      if (itemId != null) 'item_id': itemId,
      if (unitId != null) 'unit_id': unitId,
      if (qty != null) 'qty': qty,
      if (qtyBase != null) 'qty_base': qtyBase,
      if (unitPrice != null) 'unit_price': unitPrice,
      if (netLine != null) 'net_line': netLine,
    });
  }

  StatementLineRowsCompanion copyWith({
    Value<int>? id,
    Value<int>? statementId,
    Value<int>? itemId,
    Value<int>? unitId,
    Value<double>? qty,
    Value<double>? qtyBase,
    Value<double>? unitPrice,
    Value<double>? netLine,
  }) {
    return StatementLineRowsCompanion(
      id: id ?? this.id,
      statementId: statementId ?? this.statementId,
      itemId: itemId ?? this.itemId,
      unitId: unitId ?? this.unitId,
      qty: qty ?? this.qty,
      qtyBase: qtyBase ?? this.qtyBase,
      unitPrice: unitPrice ?? this.unitPrice,
      netLine: netLine ?? this.netLine,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (statementId.present) {
      map['statement_id'] = Variable<int>(statementId.value);
    }
    if (itemId.present) {
      map['item_id'] = Variable<int>(itemId.value);
    }
    if (unitId.present) {
      map['unit_id'] = Variable<int>(unitId.value);
    }
    if (qty.present) {
      map['qty'] = Variable<double>(qty.value);
    }
    if (qtyBase.present) {
      map['qty_base'] = Variable<double>(qtyBase.value);
    }
    if (unitPrice.present) {
      map['unit_price'] = Variable<double>(unitPrice.value);
    }
    if (netLine.present) {
      map['net_line'] = Variable<double>(netLine.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StatementLineRowsCompanion(')
          ..write('id: $id, ')
          ..write('statementId: $statementId, ')
          ..write('itemId: $itemId, ')
          ..write('unitId: $unitId, ')
          ..write('qty: $qty, ')
          ..write('qtyBase: $qtyBase, ')
          ..write('unitPrice: $unitPrice, ')
          ..write('netLine: $netLine')
          ..write(')'))
        .toString();
  }
}

class $MetaTable extends Meta with TableInfo<$MetaTable, MetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<MetaData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  MetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MetaData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $MetaTable createAlias(String alias) {
    return $MetaTable(attachedDatabase, alias);
  }
}

class MetaData extends DataClass implements Insertable<MetaData> {
  final String key;
  final String value;
  const MetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  MetaCompanion toCompanion(bool nullToAbsent) {
    return MetaCompanion(key: Value(key), value: Value(value));
  }

  factory MetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  MetaData copyWith({String? key, String? value}) =>
      MetaData(key: key ?? this.key, value: value ?? this.value);
  MetaData copyWithCompanion(MetaCompanion data) {
    return MetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MetaData && other.key == this.key && other.value == this.value);
}

class MetaCompanion extends UpdateCompanion<MetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const MetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<MetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MetaCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return MetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $ItemsTable items = $ItemsTable(this);
  late final $ItemUnitsTable itemUnits = $ItemUnitsTable(this);
  late final $CustomersTable customers = $CustomersTable(this);
  late final $PriceListsTable priceLists = $PriceListsTable(this);
  late final $ItemPricesTable itemPrices = $ItemPricesTable(this);
  late final $StatementRowsTable statementRows = $StatementRowsTable(this);
  late final $StatementLineRowsTable statementLineRows =
      $StatementLineRowsTable(this);
  late final $MetaTable meta = $MetaTable(this);
  late final Index idxItemsCode = Index(
    'idx_items_code',
    'CREATE INDEX idx_items_code ON items (code)',
  );
  late final Index idxItemUnitsItem = Index(
    'idx_item_units_item',
    'CREATE INDEX idx_item_units_item ON item_units (item_id)',
  );
  late final Index idxItemUnitsBarcode = Index(
    'idx_item_units_barcode',
    'CREATE INDEX idx_item_units_barcode ON item_units (barcode)',
  );
  late final Index idxCustomersCode = Index(
    'idx_customers_code',
    'CREATE INDEX idx_customers_code ON customers (code)',
  );
  late final Index idxCustomersName = Index(
    'idx_customers_name',
    'CREATE INDEX idx_customers_name ON customers (name)',
  );
  late final Index idxItemPricesItem = Index(
    'idx_item_prices_item',
    'CREATE INDEX idx_item_prices_item ON item_prices (item_id)',
  );
  late final Index idxStatementRowsCustomer = Index(
    'idx_statement_rows_customer',
    'CREATE INDEX idx_statement_rows_customer ON statement_rows (customer_id)',
  );
  late final Index idxStatementRowsDate = Index(
    'idx_statement_rows_date',
    'CREATE INDEX idx_statement_rows_date ON statement_rows (date)',
  );
  late final Index idxStatementLinesStatement = Index(
    'idx_statement_lines_statement',
    'CREATE INDEX idx_statement_lines_statement ON statement_line_rows (statement_id)',
  );
  late final Index idxStatementLinesItem = Index(
    'idx_statement_lines_item',
    'CREATE INDEX idx_statement_lines_item ON statement_line_rows (item_id)',
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    items,
    itemUnits,
    customers,
    priceLists,
    itemPrices,
    statementRows,
    statementLineRows,
    meta,
    idxItemsCode,
    idxItemUnitsItem,
    idxItemUnitsBarcode,
    idxCustomersCode,
    idxCustomersName,
    idxItemPricesItem,
    idxStatementRowsCustomer,
    idxStatementRowsDate,
    idxStatementLinesStatement,
    idxStatementLinesItem,
  ];
}

typedef $$ItemsTableCreateCompanionBuilder =
    ItemsCompanion Function({
      Value<int> id,
      required String code,
      required String name,
      Value<String?> baseUnit,
      Value<double?> lastPrice,
      Value<String?> categoryCode,
      Value<String?> barcode,
    });
typedef $$ItemsTableUpdateCompanionBuilder =
    ItemsCompanion Function({
      Value<int> id,
      Value<String> code,
      Value<String> name,
      Value<String?> baseUnit,
      Value<double?> lastPrice,
      Value<String?> categoryCode,
      Value<String?> barcode,
    });

class $$ItemsTableFilterComposer extends Composer<_$AppDatabase, $ItemsTable> {
  $$ItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get baseUnit => $composableBuilder(
    column: $table.baseUnit,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get lastPrice => $composableBuilder(
    column: $table.lastPrice,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get categoryCode => $composableBuilder(
    column: $table.categoryCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $ItemsTable> {
  $$ItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get baseUnit => $composableBuilder(
    column: $table.baseUnit,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get lastPrice => $composableBuilder(
    column: $table.lastPrice,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get categoryCode => $composableBuilder(
    column: $table.categoryCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ItemsTable> {
  $$ItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get baseUnit =>
      $composableBuilder(column: $table.baseUnit, builder: (column) => column);

  GeneratedColumn<double> get lastPrice =>
      $composableBuilder(column: $table.lastPrice, builder: (column) => column);

  GeneratedColumn<String> get categoryCode => $composableBuilder(
    column: $table.categoryCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);
}

class $$ItemsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ItemsTable,
          Item,
          $$ItemsTableFilterComposer,
          $$ItemsTableOrderingComposer,
          $$ItemsTableAnnotationComposer,
          $$ItemsTableCreateCompanionBuilder,
          $$ItemsTableUpdateCompanionBuilder,
          (Item, BaseReferences<_$AppDatabase, $ItemsTable, Item>),
          Item,
          PrefetchHooks Function()
        > {
  $$ItemsTableTableManager(_$AppDatabase db, $ItemsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> code = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> baseUnit = const Value.absent(),
                Value<double?> lastPrice = const Value.absent(),
                Value<String?> categoryCode = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
              }) => ItemsCompanion(
                id: id,
                code: code,
                name: name,
                baseUnit: baseUnit,
                lastPrice: lastPrice,
                categoryCode: categoryCode,
                barcode: barcode,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String code,
                required String name,
                Value<String?> baseUnit = const Value.absent(),
                Value<double?> lastPrice = const Value.absent(),
                Value<String?> categoryCode = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
              }) => ItemsCompanion.insert(
                id: id,
                code: code,
                name: name,
                baseUnit: baseUnit,
                lastPrice: lastPrice,
                categoryCode: categoryCode,
                barcode: barcode,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ItemsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ItemsTable,
      Item,
      $$ItemsTableFilterComposer,
      $$ItemsTableOrderingComposer,
      $$ItemsTableAnnotationComposer,
      $$ItemsTableCreateCompanionBuilder,
      $$ItemsTableUpdateCompanionBuilder,
      (Item, BaseReferences<_$AppDatabase, $ItemsTable, Item>),
      Item,
      PrefetchHooks Function()
    >;
typedef $$ItemUnitsTableCreateCompanionBuilder =
    ItemUnitsCompanion Function({
      required int itemId,
      required int unitId,
      Value<String?> unitCode,
      required double factorToBase,
      Value<bool> allowDecimal,
      Value<String?> barcode,
      Value<bool> isSale,
      Value<bool> isPurchase,
      Value<int> rowid,
    });
typedef $$ItemUnitsTableUpdateCompanionBuilder =
    ItemUnitsCompanion Function({
      Value<int> itemId,
      Value<int> unitId,
      Value<String?> unitCode,
      Value<double> factorToBase,
      Value<bool> allowDecimal,
      Value<String?> barcode,
      Value<bool> isSale,
      Value<bool> isPurchase,
      Value<int> rowid,
    });

class $$ItemUnitsTableFilterComposer
    extends Composer<_$AppDatabase, $ItemUnitsTable> {
  $$ItemUnitsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get unitCode => $composableBuilder(
    column: $table.unitCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get factorToBase => $composableBuilder(
    column: $table.factorToBase,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get allowDecimal => $composableBuilder(
    column: $table.allowDecimal,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isSale => $composableBuilder(
    column: $table.isSale,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isPurchase => $composableBuilder(
    column: $table.isPurchase,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ItemUnitsTableOrderingComposer
    extends Composer<_$AppDatabase, $ItemUnitsTable> {
  $$ItemUnitsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get unitCode => $composableBuilder(
    column: $table.unitCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get factorToBase => $composableBuilder(
    column: $table.factorToBase,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get allowDecimal => $composableBuilder(
    column: $table.allowDecimal,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get barcode => $composableBuilder(
    column: $table.barcode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isSale => $composableBuilder(
    column: $table.isSale,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isPurchase => $composableBuilder(
    column: $table.isPurchase,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ItemUnitsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ItemUnitsTable> {
  $$ItemUnitsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get itemId =>
      $composableBuilder(column: $table.itemId, builder: (column) => column);

  GeneratedColumn<int> get unitId =>
      $composableBuilder(column: $table.unitId, builder: (column) => column);

  GeneratedColumn<String> get unitCode =>
      $composableBuilder(column: $table.unitCode, builder: (column) => column);

  GeneratedColumn<double> get factorToBase => $composableBuilder(
    column: $table.factorToBase,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get allowDecimal => $composableBuilder(
    column: $table.allowDecimal,
    builder: (column) => column,
  );

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<bool> get isSale =>
      $composableBuilder(column: $table.isSale, builder: (column) => column);

  GeneratedColumn<bool> get isPurchase => $composableBuilder(
    column: $table.isPurchase,
    builder: (column) => column,
  );
}

class $$ItemUnitsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ItemUnitsTable,
          ItemUnit,
          $$ItemUnitsTableFilterComposer,
          $$ItemUnitsTableOrderingComposer,
          $$ItemUnitsTableAnnotationComposer,
          $$ItemUnitsTableCreateCompanionBuilder,
          $$ItemUnitsTableUpdateCompanionBuilder,
          (ItemUnit, BaseReferences<_$AppDatabase, $ItemUnitsTable, ItemUnit>),
          ItemUnit,
          PrefetchHooks Function()
        > {
  $$ItemUnitsTableTableManager(_$AppDatabase db, $ItemUnitsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ItemUnitsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ItemUnitsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ItemUnitsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> itemId = const Value.absent(),
                Value<int> unitId = const Value.absent(),
                Value<String?> unitCode = const Value.absent(),
                Value<double> factorToBase = const Value.absent(),
                Value<bool> allowDecimal = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<bool> isSale = const Value.absent(),
                Value<bool> isPurchase = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ItemUnitsCompanion(
                itemId: itemId,
                unitId: unitId,
                unitCode: unitCode,
                factorToBase: factorToBase,
                allowDecimal: allowDecimal,
                barcode: barcode,
                isSale: isSale,
                isPurchase: isPurchase,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required int itemId,
                required int unitId,
                Value<String?> unitCode = const Value.absent(),
                required double factorToBase,
                Value<bool> allowDecimal = const Value.absent(),
                Value<String?> barcode = const Value.absent(),
                Value<bool> isSale = const Value.absent(),
                Value<bool> isPurchase = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ItemUnitsCompanion.insert(
                itemId: itemId,
                unitId: unitId,
                unitCode: unitCode,
                factorToBase: factorToBase,
                allowDecimal: allowDecimal,
                barcode: barcode,
                isSale: isSale,
                isPurchase: isPurchase,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ItemUnitsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ItemUnitsTable,
      ItemUnit,
      $$ItemUnitsTableFilterComposer,
      $$ItemUnitsTableOrderingComposer,
      $$ItemUnitsTableAnnotationComposer,
      $$ItemUnitsTableCreateCompanionBuilder,
      $$ItemUnitsTableUpdateCompanionBuilder,
      (ItemUnit, BaseReferences<_$AppDatabase, $ItemUnitsTable, ItemUnit>),
      ItemUnit,
      PrefetchHooks Function()
    >;
typedef $$CustomersTableCreateCompanionBuilder =
    CustomersCompanion Function({
      Value<int> id,
      required String code,
      required String name,
      Value<String?> phone,
      Value<double> balance,
      Value<double?> lat,
      Value<double?> lng,
      Value<int?> priceListId,
      Value<String?> lastStatementJson,
    });
typedef $$CustomersTableUpdateCompanionBuilder =
    CustomersCompanion Function({
      Value<int> id,
      Value<String> code,
      Value<String> name,
      Value<String?> phone,
      Value<double> balance,
      Value<double?> lat,
      Value<double?> lng,
      Value<int?> priceListId,
      Value<String?> lastStatementJson,
    });

class $$CustomersTableFilterComposer
    extends Composer<_$AppDatabase, $CustomersTable> {
  $$CustomersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get balance => $composableBuilder(
    column: $table.balance,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get lat => $composableBuilder(
    column: $table.lat,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get lng => $composableBuilder(
    column: $table.lng,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastStatementJson => $composableBuilder(
    column: $table.lastStatementJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CustomersTableOrderingComposer
    extends Composer<_$AppDatabase, $CustomersTable> {
  $$CustomersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get balance => $composableBuilder(
    column: $table.balance,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get lat => $composableBuilder(
    column: $table.lat,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get lng => $composableBuilder(
    column: $table.lng,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastStatementJson => $composableBuilder(
    column: $table.lastStatementJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CustomersTableAnnotationComposer
    extends Composer<_$AppDatabase, $CustomersTable> {
  $$CustomersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get phone =>
      $composableBuilder(column: $table.phone, builder: (column) => column);

  GeneratedColumn<double> get balance =>
      $composableBuilder(column: $table.balance, builder: (column) => column);

  GeneratedColumn<double> get lat =>
      $composableBuilder(column: $table.lat, builder: (column) => column);

  GeneratedColumn<double> get lng =>
      $composableBuilder(column: $table.lng, builder: (column) => column);

  GeneratedColumn<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastStatementJson => $composableBuilder(
    column: $table.lastStatementJson,
    builder: (column) => column,
  );
}

class $$CustomersTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CustomersTable,
          Customer,
          $$CustomersTableFilterComposer,
          $$CustomersTableOrderingComposer,
          $$CustomersTableAnnotationComposer,
          $$CustomersTableCreateCompanionBuilder,
          $$CustomersTableUpdateCompanionBuilder,
          (Customer, BaseReferences<_$AppDatabase, $CustomersTable, Customer>),
          Customer,
          PrefetchHooks Function()
        > {
  $$CustomersTableTableManager(_$AppDatabase db, $CustomersTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CustomersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CustomersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CustomersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> code = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<double> balance = const Value.absent(),
                Value<double?> lat = const Value.absent(),
                Value<double?> lng = const Value.absent(),
                Value<int?> priceListId = const Value.absent(),
                Value<String?> lastStatementJson = const Value.absent(),
              }) => CustomersCompanion(
                id: id,
                code: code,
                name: name,
                phone: phone,
                balance: balance,
                lat: lat,
                lng: lng,
                priceListId: priceListId,
                lastStatementJson: lastStatementJson,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String code,
                required String name,
                Value<String?> phone = const Value.absent(),
                Value<double> balance = const Value.absent(),
                Value<double?> lat = const Value.absent(),
                Value<double?> lng = const Value.absent(),
                Value<int?> priceListId = const Value.absent(),
                Value<String?> lastStatementJson = const Value.absent(),
              }) => CustomersCompanion.insert(
                id: id,
                code: code,
                name: name,
                phone: phone,
                balance: balance,
                lat: lat,
                lng: lng,
                priceListId: priceListId,
                lastStatementJson: lastStatementJson,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CustomersTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CustomersTable,
      Customer,
      $$CustomersTableFilterComposer,
      $$CustomersTableOrderingComposer,
      $$CustomersTableAnnotationComposer,
      $$CustomersTableCreateCompanionBuilder,
      $$CustomersTableUpdateCompanionBuilder,
      (Customer, BaseReferences<_$AppDatabase, $CustomersTable, Customer>),
      Customer,
      PrefetchHooks Function()
    >;
typedef $$PriceListsTableCreateCompanionBuilder =
    PriceListsCompanion Function({
      Value<int> id,
      required String code,
      required String name,
    });
typedef $$PriceListsTableUpdateCompanionBuilder =
    PriceListsCompanion Function({
      Value<int> id,
      Value<String> code,
      Value<String> name,
    });

class $$PriceListsTableFilterComposer
    extends Composer<_$AppDatabase, $PriceListsTable> {
  $$PriceListsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PriceListsTableOrderingComposer
    extends Composer<_$AppDatabase, $PriceListsTable> {
  $$PriceListsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get code => $composableBuilder(
    column: $table.code,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PriceListsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PriceListsTable> {
  $$PriceListsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);
}

class $$PriceListsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PriceListsTable,
          PriceList,
          $$PriceListsTableFilterComposer,
          $$PriceListsTableOrderingComposer,
          $$PriceListsTableAnnotationComposer,
          $$PriceListsTableCreateCompanionBuilder,
          $$PriceListsTableUpdateCompanionBuilder,
          (
            PriceList,
            BaseReferences<_$AppDatabase, $PriceListsTable, PriceList>,
          ),
          PriceList,
          PrefetchHooks Function()
        > {
  $$PriceListsTableTableManager(_$AppDatabase db, $PriceListsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PriceListsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PriceListsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PriceListsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> code = const Value.absent(),
                Value<String> name = const Value.absent(),
              }) => PriceListsCompanion(id: id, code: code, name: name),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String code,
                required String name,
              }) => PriceListsCompanion.insert(id: id, code: code, name: name),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PriceListsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PriceListsTable,
      PriceList,
      $$PriceListsTableFilterComposer,
      $$PriceListsTableOrderingComposer,
      $$PriceListsTableAnnotationComposer,
      $$PriceListsTableCreateCompanionBuilder,
      $$PriceListsTableUpdateCompanionBuilder,
      (PriceList, BaseReferences<_$AppDatabase, $PriceListsTable, PriceList>),
      PriceList,
      PrefetchHooks Function()
    >;
typedef $$ItemPricesTableCreateCompanionBuilder =
    ItemPricesCompanion Function({
      Value<int> id,
      required int priceListId,
      required int itemId,
      required int unitId,
      required double price,
    });
typedef $$ItemPricesTableUpdateCompanionBuilder =
    ItemPricesCompanion Function({
      Value<int> id,
      Value<int> priceListId,
      Value<int> itemId,
      Value<int> unitId,
      Value<double> price,
    });

class $$ItemPricesTableFilterComposer
    extends Composer<_$AppDatabase, $ItemPricesTable> {
  $$ItemPricesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get price => $composableBuilder(
    column: $table.price,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ItemPricesTableOrderingComposer
    extends Composer<_$AppDatabase, $ItemPricesTable> {
  $$ItemPricesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get price => $composableBuilder(
    column: $table.price,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ItemPricesTableAnnotationComposer
    extends Composer<_$AppDatabase, $ItemPricesTable> {
  $$ItemPricesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get priceListId => $composableBuilder(
    column: $table.priceListId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get itemId =>
      $composableBuilder(column: $table.itemId, builder: (column) => column);

  GeneratedColumn<int> get unitId =>
      $composableBuilder(column: $table.unitId, builder: (column) => column);

  GeneratedColumn<double> get price =>
      $composableBuilder(column: $table.price, builder: (column) => column);
}

class $$ItemPricesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ItemPricesTable,
          ItemPrice,
          $$ItemPricesTableFilterComposer,
          $$ItemPricesTableOrderingComposer,
          $$ItemPricesTableAnnotationComposer,
          $$ItemPricesTableCreateCompanionBuilder,
          $$ItemPricesTableUpdateCompanionBuilder,
          (
            ItemPrice,
            BaseReferences<_$AppDatabase, $ItemPricesTable, ItemPrice>,
          ),
          ItemPrice,
          PrefetchHooks Function()
        > {
  $$ItemPricesTableTableManager(_$AppDatabase db, $ItemPricesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ItemPricesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ItemPricesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ItemPricesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<int> priceListId = const Value.absent(),
                Value<int> itemId = const Value.absent(),
                Value<int> unitId = const Value.absent(),
                Value<double> price = const Value.absent(),
              }) => ItemPricesCompanion(
                id: id,
                priceListId: priceListId,
                itemId: itemId,
                unitId: unitId,
                price: price,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required int priceListId,
                required int itemId,
                required int unitId,
                required double price,
              }) => ItemPricesCompanion.insert(
                id: id,
                priceListId: priceListId,
                itemId: itemId,
                unitId: unitId,
                price: price,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ItemPricesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ItemPricesTable,
      ItemPrice,
      $$ItemPricesTableFilterComposer,
      $$ItemPricesTableOrderingComposer,
      $$ItemPricesTableAnnotationComposer,
      $$ItemPricesTableCreateCompanionBuilder,
      $$ItemPricesTableUpdateCompanionBuilder,
      (ItemPrice, BaseReferences<_$AppDatabase, $ItemPricesTable, ItemPrice>),
      ItemPrice,
      PrefetchHooks Function()
    >;
typedef $$StatementRowsTableCreateCompanionBuilder =
    StatementRowsCompanion Function({
      Value<int> id,
      required String number,
      required int customerId,
      required DateTime date,
      required String status,
      required double net,
    });
typedef $$StatementRowsTableUpdateCompanionBuilder =
    StatementRowsCompanion Function({
      Value<int> id,
      Value<String> number,
      Value<int> customerId,
      Value<DateTime> date,
      Value<String> status,
      Value<double> net,
    });

class $$StatementRowsTableFilterComposer
    extends Composer<_$AppDatabase, $StatementRowsTable> {
  $$StatementRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get net => $composableBuilder(
    column: $table.net,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StatementRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $StatementRowsTable> {
  $$StatementRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get date => $composableBuilder(
    column: $table.date,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get net => $composableBuilder(
    column: $table.net,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StatementRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $StatementRowsTable> {
  $$StatementRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get number =>
      $composableBuilder(column: $table.number, builder: (column) => column);

  GeneratedColumn<int> get customerId => $composableBuilder(
    column: $table.customerId,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<double> get net =>
      $composableBuilder(column: $table.net, builder: (column) => column);
}

class $$StatementRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $StatementRowsTable,
          StatementRow,
          $$StatementRowsTableFilterComposer,
          $$StatementRowsTableOrderingComposer,
          $$StatementRowsTableAnnotationComposer,
          $$StatementRowsTableCreateCompanionBuilder,
          $$StatementRowsTableUpdateCompanionBuilder,
          (
            StatementRow,
            BaseReferences<_$AppDatabase, $StatementRowsTable, StatementRow>,
          ),
          StatementRow,
          PrefetchHooks Function()
        > {
  $$StatementRowsTableTableManager(_$AppDatabase db, $StatementRowsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StatementRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StatementRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StatementRowsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> number = const Value.absent(),
                Value<int> customerId = const Value.absent(),
                Value<DateTime> date = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<double> net = const Value.absent(),
              }) => StatementRowsCompanion(
                id: id,
                number: number,
                customerId: customerId,
                date: date,
                status: status,
                net: net,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String number,
                required int customerId,
                required DateTime date,
                required String status,
                required double net,
              }) => StatementRowsCompanion.insert(
                id: id,
                number: number,
                customerId: customerId,
                date: date,
                status: status,
                net: net,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StatementRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $StatementRowsTable,
      StatementRow,
      $$StatementRowsTableFilterComposer,
      $$StatementRowsTableOrderingComposer,
      $$StatementRowsTableAnnotationComposer,
      $$StatementRowsTableCreateCompanionBuilder,
      $$StatementRowsTableUpdateCompanionBuilder,
      (
        StatementRow,
        BaseReferences<_$AppDatabase, $StatementRowsTable, StatementRow>,
      ),
      StatementRow,
      PrefetchHooks Function()
    >;
typedef $$StatementLineRowsTableCreateCompanionBuilder =
    StatementLineRowsCompanion Function({
      Value<int> id,
      required int statementId,
      required int itemId,
      required int unitId,
      required double qty,
      required double qtyBase,
      required double unitPrice,
      required double netLine,
    });
typedef $$StatementLineRowsTableUpdateCompanionBuilder =
    StatementLineRowsCompanion Function({
      Value<int> id,
      Value<int> statementId,
      Value<int> itemId,
      Value<int> unitId,
      Value<double> qty,
      Value<double> qtyBase,
      Value<double> unitPrice,
      Value<double> netLine,
    });

class $$StatementLineRowsTableFilterComposer
    extends Composer<_$AppDatabase, $StatementLineRowsTable> {
  $$StatementLineRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get statementId => $composableBuilder(
    column: $table.statementId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get qty => $composableBuilder(
    column: $table.qty,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get qtyBase => $composableBuilder(
    column: $table.qtyBase,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get unitPrice => $composableBuilder(
    column: $table.unitPrice,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get netLine => $composableBuilder(
    column: $table.netLine,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StatementLineRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $StatementLineRowsTable> {
  $$StatementLineRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get statementId => $composableBuilder(
    column: $table.statementId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get itemId => $composableBuilder(
    column: $table.itemId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get qty => $composableBuilder(
    column: $table.qty,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get qtyBase => $composableBuilder(
    column: $table.qtyBase,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get unitPrice => $composableBuilder(
    column: $table.unitPrice,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get netLine => $composableBuilder(
    column: $table.netLine,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StatementLineRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $StatementLineRowsTable> {
  $$StatementLineRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get statementId => $composableBuilder(
    column: $table.statementId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get itemId =>
      $composableBuilder(column: $table.itemId, builder: (column) => column);

  GeneratedColumn<int> get unitId =>
      $composableBuilder(column: $table.unitId, builder: (column) => column);

  GeneratedColumn<double> get qty =>
      $composableBuilder(column: $table.qty, builder: (column) => column);

  GeneratedColumn<double> get qtyBase =>
      $composableBuilder(column: $table.qtyBase, builder: (column) => column);

  GeneratedColumn<double> get unitPrice =>
      $composableBuilder(column: $table.unitPrice, builder: (column) => column);

  GeneratedColumn<double> get netLine =>
      $composableBuilder(column: $table.netLine, builder: (column) => column);
}

class $$StatementLineRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $StatementLineRowsTable,
          StatementLineRow,
          $$StatementLineRowsTableFilterComposer,
          $$StatementLineRowsTableOrderingComposer,
          $$StatementLineRowsTableAnnotationComposer,
          $$StatementLineRowsTableCreateCompanionBuilder,
          $$StatementLineRowsTableUpdateCompanionBuilder,
          (
            StatementLineRow,
            BaseReferences<
              _$AppDatabase,
              $StatementLineRowsTable,
              StatementLineRow
            >,
          ),
          StatementLineRow,
          PrefetchHooks Function()
        > {
  $$StatementLineRowsTableTableManager(
    _$AppDatabase db,
    $StatementLineRowsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StatementLineRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StatementLineRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StatementLineRowsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<int> statementId = const Value.absent(),
                Value<int> itemId = const Value.absent(),
                Value<int> unitId = const Value.absent(),
                Value<double> qty = const Value.absent(),
                Value<double> qtyBase = const Value.absent(),
                Value<double> unitPrice = const Value.absent(),
                Value<double> netLine = const Value.absent(),
              }) => StatementLineRowsCompanion(
                id: id,
                statementId: statementId,
                itemId: itemId,
                unitId: unitId,
                qty: qty,
                qtyBase: qtyBase,
                unitPrice: unitPrice,
                netLine: netLine,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required int statementId,
                required int itemId,
                required int unitId,
                required double qty,
                required double qtyBase,
                required double unitPrice,
                required double netLine,
              }) => StatementLineRowsCompanion.insert(
                id: id,
                statementId: statementId,
                itemId: itemId,
                unitId: unitId,
                qty: qty,
                qtyBase: qtyBase,
                unitPrice: unitPrice,
                netLine: netLine,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StatementLineRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $StatementLineRowsTable,
      StatementLineRow,
      $$StatementLineRowsTableFilterComposer,
      $$StatementLineRowsTableOrderingComposer,
      $$StatementLineRowsTableAnnotationComposer,
      $$StatementLineRowsTableCreateCompanionBuilder,
      $$StatementLineRowsTableUpdateCompanionBuilder,
      (
        StatementLineRow,
        BaseReferences<
          _$AppDatabase,
          $StatementLineRowsTable,
          StatementLineRow
        >,
      ),
      StatementLineRow,
      PrefetchHooks Function()
    >;
typedef $$MetaTableCreateCompanionBuilder =
    MetaCompanion Function({
      required String key,
      required String value,
      Value<int> rowid,
    });
typedef $$MetaTableUpdateCompanionBuilder =
    MetaCompanion Function({
      Value<String> key,
      Value<String> value,
      Value<int> rowid,
    });

class $$MetaTableFilterComposer extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MetaTableOrderingComposer extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$MetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MetaTable,
          MetaData,
          $$MetaTableFilterComposer,
          $$MetaTableOrderingComposer,
          $$MetaTableAnnotationComposer,
          $$MetaTableCreateCompanionBuilder,
          $$MetaTableUpdateCompanionBuilder,
          (MetaData, BaseReferences<_$AppDatabase, $MetaTable, MetaData>),
          MetaData,
          PrefetchHooks Function()
        > {
  $$MetaTableTableManager(_$AppDatabase db, $MetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => MetaCompanion.insert(key: key, value: value, rowid: rowid),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MetaTable,
      MetaData,
      $$MetaTableFilterComposer,
      $$MetaTableOrderingComposer,
      $$MetaTableAnnotationComposer,
      $$MetaTableCreateCompanionBuilder,
      $$MetaTableUpdateCompanionBuilder,
      (MetaData, BaseReferences<_$AppDatabase, $MetaTable, MetaData>),
      MetaData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$ItemsTableTableManager get items =>
      $$ItemsTableTableManager(_db, _db.items);
  $$ItemUnitsTableTableManager get itemUnits =>
      $$ItemUnitsTableTableManager(_db, _db.itemUnits);
  $$CustomersTableTableManager get customers =>
      $$CustomersTableTableManager(_db, _db.customers);
  $$PriceListsTableTableManager get priceLists =>
      $$PriceListsTableTableManager(_db, _db.priceLists);
  $$ItemPricesTableTableManager get itemPrices =>
      $$ItemPricesTableTableManager(_db, _db.itemPrices);
  $$StatementRowsTableTableManager get statementRows =>
      $$StatementRowsTableTableManager(_db, _db.statementRows);
  $$StatementLineRowsTableTableManager get statementLineRows =>
      $$StatementLineRowsTableTableManager(_db, _db.statementLineRows);
  $$MetaTableTableManager get meta => $$MetaTableTableManager(_db, _db.meta);
}
