import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/outbox.dart';
import '../../core/print/esc_pos.dart';
import '../../core/print/pdf_export.dart';
import '../../core/print/printer.dart';
import '../../core/print/receipt.dart';
import '../../core/print/receipt_renderer.dart';
import '../../core/providers.dart';

/// عملية جارية في شاشة الطباعة.
enum PrintStatus { idle, scanning, connecting, printing, sharing }

class PrintState {
  /// مستندات صندوق الصادر القابلة للطباعة.
  final List<OutboxItem> documents;

  final OutboxItem? selected;
  final ReceiptDoc? doc;
  final ReceiptPaper paper;
  final Uint8List? previewPng;

  final PrintStatus status;
  final List<PrinterDevice> printers;
  final PrinterDevice? printer;
  final String? lastPrinterAddress;
  final String? error;
  final String? message;

  const PrintState({
    this.documents = const [],
    this.selected,
    this.doc,
    this.paper = ReceiptPaper.receipt80,
    this.previewPng,
    this.status = PrintStatus.idle,
    this.printers = const [],
    this.printer,
    this.lastPrinterAddress,
    this.error,
    this.message,
  });

  bool get busy =>
      status == PrintStatus.scanning ||
      status == PrintStatus.connecting ||
      status == PrintStatus.printing ||
      status == PrintStatus.sharing;

  bool get connected => printer != null;

  PrintState copyWith({
    List<OutboxItem>? documents,
    Object? selected = _keep,
    Object? doc = _keep,
    ReceiptPaper? paper,
    Object? previewPng = _keep,
    PrintStatus? status,
    List<PrinterDevice>? printers,
    Object? printer = _keep,
    String? lastPrinterAddress,
    Object? error = _keep,
    Object? message = _keep,
  }) {
    return PrintState(
      documents: documents ?? this.documents,
      selected: identical(selected, _keep) ? this.selected : selected as OutboxItem?,
      doc: identical(doc, _keep) ? this.doc : doc as ReceiptDoc?,
      paper: paper ?? this.paper,
      previewPng:
          identical(previewPng, _keep) ? this.previewPng : previewPng as Uint8List?,
      status: status ?? this.status,
      printers: printers ?? this.printers,
      printer: identical(printer, _keep) ? this.printer : printer as PrinterDevice?,
      lastPrinterAddress: lastPrinterAddress ?? this.lastPrinterAddress,
      error: identical(error, _keep) ? this.error : error as String?,
      message: identical(message, _keep) ? this.message : message as String?,
    );
  }
}

/// علامة ضمنية داخل `copyWith` للتمييز بين «لم يتغيّر» و«أُفرِغ إلى null».
const _keep = Object();

/// يربط واجهة الطباعة ببقية التطبيق: بناء المستند من صندوق الصادر، البحث عن
/// الطابعة والاتصال بها، إرسال صورة ESC/POS، وتصدير PDF للمشاركة.
class PrintController extends Notifier<PrintState> {
  @override
  PrintState build() {
    return PrintState(
      documents: ref.read(outboxProvider).all,
      lastPrinterAddress: ref.read(sessionProvider).printerAddress,
    );
  }

  BluetoothPrinter get _printer => ref.read(bluetoothPrinterProvider);
  ReceiptContext get _context {
    final store = ref.read(dataStoreProvider);
    return ReceiptContext(
      customers: store.customers,
      statements: store.statements,
      items: store.items,
      repName: ref.read(sessionProvider).user?.name,
    );
  }

  /// يحدّث قائمة المستندات بعد أي تغيير في الصندوق.
  void refresh() {
    state = state.copyWith(
      documents: ref.read(outboxProvider).all,
      error: null,
      message: null,
    );
  }

  /// يختار مستنداً ويبني نسخته القابلة للطباعة مع معاينة.
  Future<void> select(OutboxItem item) async {
    final doc = ReceiptDoc.fromOutboxItem(item, _context);
    state = state.copyWith(selected: item, doc: doc, error: null, message: null);
    try {
      final png = await ReceiptRenderer.renderPng(doc, widthPx: 480);
      state = state.copyWith(previewPng: png);
    } catch (e) {
      state = state.copyWith(error: 'تعذّر توليد المعاينة: $e');
    }
  }

  void setPaper(ReceiptPaper paper) {
    state = state.copyWith(paper: paper, error: null, message: null);
  }

  /// يعود لقائمة المستندات (يُبقي اتصال الطابعة قائماً).
  void clearSelection() {
    state = state.copyWith(
      selected: null,
      doc: null,
      previewPng: null,
      error: null,
      message: null,
    );
  }

  /// يبحث عن الطابعات المتاحة.
  Future<void> scan() async {
    if (state.busy) return;
    state = state.copyWith(status: PrintStatus.scanning, error: null, message: null);
    try {
      final found = await _printer.scan();
      state = state.copyWith(status: PrintStatus.idle, printers: found);
    } catch (e) {
      state = state.copyWith(status: PrintStatus.idle, error: _message(e, 'تعذّر البحث'));
    }
  }

  /// يتصل بالطابعة ويحفظ عنوانها للجلسات القادمة.
  Future<void> connect(PrinterDevice device) async {
    if (state.busy) return;
    state = state.copyWith(status: PrintStatus.connecting, error: null, message: null);
    try {
      await _printer.connect(device);
      await ref.read(sessionProvider).savePrinterAddress(device.address);
      state = state.copyWith(
        status: PrintStatus.idle,
        printer: device,
        lastPrinterAddress: device.address,
        message: 'متصل بالطابعة: ${device.display}',
      );
    } catch (e) {
      state = state.copyWith(status: PrintStatus.idle, error: _message(e, 'تعذّر الاتصال'));
    }
  }

  Future<void> disconnect() async {
    if (state.printer == null) return;
    await _printer.disconnect();
    state = state.copyWith(printer: null, message: 'تم قطع الاتصال');
  }

  /// يطبع المستند المختار: يرسمه بدقة الورقة ثم يرسله كأمر صورة نقطية.
  Future<void> printCurrent() async {
    final doc = state.doc;
    final printer = state.printer;
    if (doc == null) {
      state = state.copyWith(error: 'اختر مستنداً أولاً');
      return;
    }
    if (printer == null) {
      state = state.copyWith(error: 'اتصل بطابعة أولاً');
      return;
    }
    state = state.copyWith(status: PrintStatus.printing, error: null, message: null);
    try {
      final raster = await ReceiptRenderer.renderRgba(
        doc,
        widthPx: state.paper.renderWidthPx,
      );
      final bitmap = rasterFromRgba(
        raster.rgba,
        width: raster.width,
        height: raster.height,
      );
      final esc = EscPos()
        ..init()
        ..imageRaster(bitmap, widthDots: raster.width, heightDots: raster.height)
        ..feedLines(4)
        ..cut();
      await _printer.write(esc.bytes);
      state = state.copyWith(
        status: PrintStatus.idle,
        message: 'طُبع المستند بنجاح',
      );
    } catch (e) {
      state = state.copyWith(status: PrintStatus.idle, error: _message(e, 'فشلت الطباعة'));
    }
  }

  /// يصدّر مستند PDF ويشاركه عبر أي تطبيق (واتساب/ملفات…).
  Future<void> sharePdf() async {
    final doc = state.doc;
    if (doc == null) {
      state = state.copyWith(error: 'اختر مستنداً أولاً');
      return;
    }
    state = state.copyWith(status: PrintStatus.sharing, error: null, message: null);
    try {
      final png = await ReceiptRenderer.renderPng(
        doc,
        widthPx: state.paper.renderWidthPx,
      );
      final pdf = await buildReceiptPdf(png, paper: state.paper);
      final fileName = '${doc.fileNameBase}.pdf';
      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(pdf, mimeType: 'application/pdf', name: fileName),
          ],
          text: '${doc.title} — ${doc.customerName ?? ''}',
          fileNameOverrides: [fileName],
        ),
      );
      state = state.copyWith(
        status: PrintStatus.idle,
        message: 'تمت مشاركة ملف PDF',
      );
    } catch (e) {
      state = state.copyWith(status: PrintStatus.idle, error: _message(e, 'فشلت المشاركة'));
    }
  }

  String _message(Object e, String fallback) {
    if (e is PrinterException) return e.message;
    return '$fallback: $e';
  }
}

final printControllerProvider =
    NotifierProvider<PrintController, PrintState>(PrintController.new);