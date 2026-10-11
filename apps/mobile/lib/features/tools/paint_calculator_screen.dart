import 'package:flutter/material.dart';

import '../../core/calc/calc.dart';

/// حاسبة كميات الدهانات (مساحة + وجوه + تغطية + حجم العبوة ← عبوات).
class PaintCalculatorScreen extends StatefulWidget {
  const PaintCalculatorScreen({super.key});

  @override
  State<PaintCalculatorScreen> createState() => _PaintCalculatorScreenState();
}

class _PaintCalculatorScreenState extends State<PaintCalculatorScreen> {
  final _area = TextEditingController(text: '100');
  final _coats = TextEditingController(text: '2');
  final _coverage = TextEditingController(text: '10');
  final _pack = TextEditingController(text: '4');

  @override
  void dispose() {
    _area.dispose();
    _coats.dispose();
    _coverage.dispose();
    _pack.dispose();
    super.dispose();
  }

  double _d(String t) => double.tryParse(t.trim()) ?? 0;
  int _i(String t) => int.tryParse(t.trim()) ?? 0;

  @override
  Widget build(BuildContext context) {
    PaintResult? result;
    String? error;
    try {
      result = calcPaint(
        areaM2: _d(_area.text),
        coats: _i(_coats.text),
        coverageM2PerL: _d(_coverage.text),
        packSizeL: _d(_pack.text),
      );
    } catch (e) {
      error = e.toString();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('حاسبة كميات الدهانات')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _area,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'المساحة (م²)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _coats,
            keyboardType: TextInputType.number,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'عدد الوجوه'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _coverage,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'تغطية اللتر (م²/لتر)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pack,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'حجم العبوة (لتر)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row('اللترات المطلوبة',
                      result == null ? null : '${result.liters.toStringAsFixed(3)} لتر'),
                  _row('عدد العبوات',
                      result == null ? null : '${result.packs} عبوة', emphasize: true),
                  const Divider(),
                  _row('إجمالي المشترى',
                      result == null ? null : '${result.purchasedLiters.toStringAsFixed(3)} لتر'),
                ],
              ),
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(error, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
        ],
      ),
    );
  }

  Widget _row(String label, String? value, {bool emphasize = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Text(label),
            const Spacer(),
            Text(
              value ?? '—',
              style: TextStyle(
                fontWeight: emphasize ? FontWeight.bold : FontWeight.normal,
                fontSize: emphasize ? 18 : 14,
              ),
            ),
          ],
        ),
      );
}