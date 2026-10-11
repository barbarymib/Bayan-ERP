import 'package:flutter/material.dart';

import '../../core/calc/calc.dart';

/// حاسبة أوزان الحديد (قطر + طول + عدد ← وزن).
class SteelCalculatorScreen extends StatefulWidget {
  const SteelCalculatorScreen({super.key});

  @override
  State<SteelCalculatorScreen> createState() => _SteelCalculatorScreenState();
}

class _SteelCalculatorScreenState extends State<SteelCalculatorScreen> {
  final _diameter = TextEditingController(text: '12');
  final _length = TextEditingController(text: '12');
  final _count = TextEditingController(text: '1');

  @override
  void dispose() {
    _diameter.dispose();
    _length.dispose();
    _count.dispose();
    super.dispose();
  }

  double _d(String t) => double.tryParse(t.trim()) ?? 0;
  int _i(String t) => int.tryParse(t.trim()) ?? 0;

  @override
  Widget build(BuildContext context) {
    double? perBar;
    double? perMeter;
    double? total;
    String? error;
    try {
      final d = _d(_diameter.text);
      final l = _d(_length.text);
      if (d > 0 && l > 0) {
        perBar = steelBarWeightKg(diameterMm: d, lengthM: l);
        perMeter = steelWeightPerMeterKg(d);
      }
      final n = _i(_count.text);
      if (d > 0 && l > 0 && n > 0) {
        total = steelWeightKg(diameterMm: d, lengthM: l, count: n);
      }
    } catch (e) {
      error = e.toString();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('حاسبة أوزان الحديد')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _diameter,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'القطر (مم)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _length,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'الطول (م)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _count,
            keyboardType: TextInputType.number,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: 'عدد الأسياخ'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row('وزن المتر الطولي', perMeter, 'كجم/م'),
                  _row('وزن السيخ الواحد', perBar, 'كجم'),
                  const Divider(),
                  _row('الوزن الإجمالي', total, 'كجم', emphasize: true),
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

  Widget _row(String label, double? value, String unit, {bool emphasize = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Text(label),
            const Spacer(),
            Text(
              value == null ? '—' : '${value.toStringAsFixed(3)} $unit',
              style: TextStyle(
                fontWeight: emphasize ? FontWeight.bold : FontWeight.normal,
                fontSize: emphasize ? 18 : 14,
              ),
            ),
          ],
        ),
      );
}