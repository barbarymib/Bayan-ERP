import 'dart:ffi';
import 'dart:io';
import 'dart:typed_data';

import 'package:bayan_rep/core/data_store.dart';
import 'package:bayan_rep/core/db/database.dart';
import 'package:bayan_rep/core/models.dart';
import 'package:bayan_rep/core/outbox.dart';
import 'package:bayan_rep/core/print/pdf_export.dart';
import 'package:bayan_rep/core/print/printer.dart';
import 'package:bayan_rep/core/providers.dart';
import 'package:bayan_rep/core/session_store.dart';
import 'package:bayan_rep/features/print/print_controller.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqlite3/open.dart';

void _enableSqliteOnWindows() {
  if (Platform.isWindows) {
    open.overrideFor(OperatingSystem.windows, () => DynamicLibrary.open('winsqlite3.dll'));
  }
}

class FakeBluetoothPrinter implements BluetoothPrinter {
  final List<PrinterDevice> devices;
  bool connected = false;
  final List<Uint8List> written = [];

  FakeBluetoothPrinter({this.devices = const []});

  @override
  Future<List<PrinterDevice>> scan() async => devices;

  @override
  Future<void> connect(PrinterDevice device) async {
    connected = true;
  }

  @override
  Future<void> disconnect() async {
    connected = false;
  }

  @override
  Future<void> write(Uint8List bytes) async {
    written.add(bytes);
  }

  @override
  bool get isConnected => connected;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  _enableSqliteOnWindows();

  late ProviderContainer container;
  late PrintController controller;
  late FakeBluetoothPrinter fake;
  late SessionStore session;
  late Outbox outbox;

  PrintState state() => container.read(printControllerProvider);

  final statementItem = OutboxItem(
    clientUuid: 'u-statement',
    type: 'price_statement',
    number: 'BP-1',
    createdAt: DateTime(2026, 10, 9, 12, 30),
    payload: const {
      'customerId': 7,
      'customerName': 'عميل 7',
      'number': 'BP-1',
      'headerDiscount': 0,
      'subtotal': 100.0,
      'headerDiscountAmount': 0,
      'net': 100.0,
      'createdAt': '2026-10-09T12:00:00.000Z',
      'lines': [
        {
          'itemId': 3,
          'name': 'حديد',
          'qty': 1,
          'unitPrice': 100,
          'discountType': 'NONE',
          'discountValue': 0,
          'netFinal': 100,
        },
      ],
    },
  );

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    session = SessionStore(prefs);

    final store = DataStore(AppDatabase.forTesting(NativeDatabase.memory()));
    await store.init();
    await store.saveCustomers(const [
      CustomerSummary(id: 7, code: 'C7', name: 'عميل 7', balance: 1000),
    ]);

    outbox = Outbox()..add(statementItem);
    fake = FakeBluetoothPrinter(
      devices: const [PrinterDevice(name: 'TP-58', address: '00:11:22:33')],
    );

    container = ProviderContainer(
      overrides: [
        sessionProvider.overrideWithValue(session),
        outboxProvider.overrideWithValue(outbox),
        dataStoreProvider.overrideWithValue(store),
        bluetoothPrinterProvider.overrideWithValue(fake),
      ],
    );
    controller = container.read(printControllerProvider.notifier);
    container.read(printControllerProvider); // يبني الحالة الابتدائية
  });

  tearDown(() => container.dispose());

  test('build يعرض مستندات الصندوق ويطبع الورقة الافتراضية 80 ملّم', () {
    expect(state().documents, hasLength(1));
    expect(state().paper, ReceiptPaper.receipt80);
    expect(state().connected, isFalse);
  });

  test('اختر مستنداً ⇒ معاينة ومستند جاهز باسم العميل من DataStore', () async {
    await controller.select(statementItem);
    expect(state().selected, isNotNull);
    expect(state().doc?.title, 'بيان أسعار');
    expect(state().doc?.customerName, 'عميل 7', reason: 'مُثري من DataStore');
    expect(state().doc?.balanceBefore, 1000);
    expect(state().previewPng, isNotNull);
    expect(state().previewPng!.isNotEmpty, isTrue);
  });

  test('الطباعة بدون اتصال ⇒ خطأ واضح', () async {
    await controller.select(statementItem);
    await controller.printCurrent();
    expect(state().error, 'اتصل بطابعة أولاً');
    expect(fake.written, isEmpty);
  });

  test('البحث والاتصال وحفظ آخر طابعة ثم الطباعة', () async {
    await controller.scan();
    expect(state().printers.map((d) => d.address), ['00:11:22:33']);

    await controller.connect(fake.devices.first);
    expect(state().connected, isTrue);
    expect(state().message, contains('متصل بالطابعة'));
    expect(session.printerAddress, '00:11:22:33', reason: 'يُحفظ للجلسات القادمة');

    await controller.select(statementItem);
    await controller.printCurrent();
    expect(fake.written, hasLength(1));
    final bytes = fake.written.first;
    expect(bytes.sublist(0, 2), [0x1B, 0x40], reason: 'تهيئة ESC @');
    expect(bytes.sublist(2, 6), [0x1D, 0x76, 0x30, 0x00], reason: 'صورة GS v 0');
    expect(bytes.sublist(bytes.length - 4), [0x1D, 0x56, 0x42, 0x00],
        reason: 'قطع جزئي في النهاية');
    expect(state().message, 'طُبع المستند بنجاح');
    expect(state().status, PrintStatus.idle);
  });

  test('تغيير الورقة وأفراغ الاختيار', () async {
    await controller.select(statementItem);
    controller.setPaper(ReceiptPaper.a4);
    expect(state().paper, ReceiptPaper.a4);

    controller.clearSelection();
    expect(state().doc, isNull);
    expect(state().selected, isNull);
    expect(state().previewPng, isNull);
  });

  test('مشاركة PDF بلا مستند ⇒ خطأ دون استدعاء المنصة', () async {
    await controller.sharePdf();
    expect(state().error, 'اختر مستنداً أولاً');
  });

  test('قطع الاتصال', () async {
    await controller.connect(fake.devices.first);
    await controller.disconnect();
    expect(state().connected, isFalse);
    expect(fake.connected, isFalse);
  });
}