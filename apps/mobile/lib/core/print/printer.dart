import 'dart:async';
import 'dart:typed_data';

import 'package:bluetooth_print_plus/bluetooth_print_plus.dart' as bpp;

/// طابعة بلوتوث مكتشفة.
class PrinterDevice {
  final String name;
  final String address;

  const PrinterDevice({required this.name, required this.address});

  String get display => name.trim().isEmpty ? address : name;

  @override
  bool operator ==(Object other) =>
      other is PrinterDevice && other.address == address;

  @override
  int get hashCode => address.hashCode;
}

/// خطأ في الاتصال/الطباعة بواجهة مفهومة للمندوب.
class PrinterException implements Exception {
  final String message;
  const PrinterException(this.message);
  @override
  String toString() => message;
}

/// واجهة طابعة محايدة (تُستبدل بنسخة زائفة في الاختبارات).
abstract class BluetoothPrinter {
  /// يبحث عن الطابعات المتاحة ويعيدها.
  Future<List<PrinterDevice>> scan();

  /// يتصل بالطابعة وينتظر اكتمال الاتصال.
  Future<void> connect(PrinterDevice device);

  /// يقطع الاتصال (يُتجاهل الفشل).
  Future<void> disconnect();

  /// يكتب بايتات خام (أوامر ESC/POS) إلى الطابعة المتصلة.
  Future<void> write(Uint8List bytes);

  /// هل هناك اتصال نشط الآن؟
  bool get isConnected;
}

/// تنفيذ [BluetoothPrinter] فوق حزمة `bluetooth_print_plus` (SPP كلاسيكي).
class BluetoothPrintPlusPrinter implements BluetoothPrinter {
  const BluetoothPrintPlusPrinter();

  @override
  Future<List<PrinterDevice>> scan() async {
    try {
      final found = await bpp.BluetoothPrintPlus.startScan(
        timeout: const Duration(seconds: 12),
      );
      return found
          .map((d) => PrinterDevice(name: d.name, address: d.address))
          .toList();
    } catch (e) {
      throw PrinterException('تعذّر البحث عن طابعة بلوتوث: $e');
    }
  }

  @override
  Future<void> connect(PrinterDevice device) async {
    try {
      await bpp.BluetoothPrintPlus.connect(
        bpp.BluetoothDevice(device.name, device.address),
      );
      await _waitConnected(const Duration(seconds: 10));
    } on PrinterException {
      rethrow;
    } catch (e) {
      throw PrinterException('تعذّر الاتصال بالطابعة: $e');
    }
  }

  Future<void> _waitConnected(Duration timeout) async {
    if (bpp.BluetoothPrintPlus.isConnected) return;
    final completer = Completer<void>();
    final sub = bpp.BluetoothPrintPlus.connectState.listen((s) {
      if (s == bpp.ConnectState.connected && !completer.isCompleted) {
        completer.complete();
      }
    });
    try {
      await completer.future.timeout(
        timeout,
        onTimeout: () => throw const PrinterException('انتهت مهلة الاتصال بالطابعة'),
      );
    } finally {
      await sub.cancel();
    }
  }

  @override
  Future<void> disconnect() async {
    try {
      await bpp.BluetoothPrintPlus.disconnect();
    } catch (_) {
      // قطع الاتصال الفاشل لا يستدعي إزعاج المستخدم.
    }
  }

  @override
  Future<void> write(Uint8List bytes) async {
    try {
      await bpp.BluetoothPrintPlus.write(bytes);
    } catch (e) {
      throw PrinterException('فشل إرسال البيانات للطابعة: $e');
    }
  }

  @override
  bool get isConnected => bpp.BluetoothPrintPlus.isConnected;
}