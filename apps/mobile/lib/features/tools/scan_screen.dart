import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/models.dart';
import '../../core/scan_resolver.dart';

/// يفتح شاشة الفحص (§9/G13) ويُعيد الزبون المطابق لكود QR (§5.16)، أو null
/// عند الإلغاء أو عدم المطابقة — مع تنبيه في كلتا الحالتين.
Future<CustomerSummary?> scanCustomer(
  BuildContext context,
  List<CustomerSummary> customers,
) async {
  if (customers.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('لا توجد عملاء متزامنون — اضغط مزامنة أولاً')),
    );
    return null;
  }
  final code = await Navigator.push<String>(
    context,
    MaterialPageRoute<String>(builder: (_) => const ScanScreen(title: 'فحص QR الزبون')),
  );
  if (code == null || !context.mounted) return null;
  final customer = resolveCustomerScan(code, customers);
  if (customer == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('لم يُعثر على زبون بالكود «$code»')),
    );
    return null;
  }
  return customer;
}

/// شاشة فحص الباركود/QR (§9/G13) — تُعيد النص المفحوص إلى الشاشة الطالبة
/// عبر `Navigator.pop`، مع إدخال يدوي بديل عند تعذّر الكاميرا.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, this.title = 'فحص باركود'});

  final String title;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [],
  );
  final TextEditingController _manual = TextEditingController();
  bool _done = false;

  @override
  void dispose() {
    _manual.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _complete(String? raw) {
    final code = raw?.trim() ?? '';
    if (code.isEmpty || _done) return;
    _done = true;
    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          ValueListenableBuilder<MobileScannerState>(
            valueListenable: _controller,
            builder: (context, state, _) {
              final on = state.torchState == TorchState.on;
              return IconButton(
                tooltip: on ? 'إطفاء الفلاش' : 'تشغيل الفلاش',
                icon: Icon(on ? Icons.flash_on : Icons.flash_off),
                onPressed: state.torchState == TorchState.unavailable
                    ? null
                    : () => _controller.toggleTorch(),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: (capture) {
                    final barcodes = capture.barcodes;
                    _complete(barcodes.isEmpty ? null : barcodes.first.rawValue);
                  },
                  errorBuilder: (context, error) => _cameraError(error),
                  placeholderBuilder: (context) =>
                      const ColoredBox(color: Colors.black),
                ),
                IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.white70,
                        width: 2,
                      ),
                    ),
                    margin: const EdgeInsets.symmetric(horizontal: 40, vertical: 120),
                  ),
                ),
                const IgnorePointer(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: EdgeInsets.only(bottom: 16),
                      child: Text(
                        'وجّه الكاميرا نحو باركود الصنف أو الوحدة',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _manual,
                      autofocus: false,
                      textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(
                        labelText: 'إدخال يدوي للباركود/الكود',
                        isDense: true,
                      ),
                      onSubmitted: _complete,
                    ),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: () => _complete(_manual.text),
                    child: const Text('تأكيد'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cameraError(MobileScannerException error) {
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_outlined, color: Colors.white70, size: 40),
              const SizedBox(height: 12),
              Text(
                'تعذّر تشغيل الكاميرا (${error.errorCode.name}) — استخدم الإدخال اليدوي بالأسفل.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
