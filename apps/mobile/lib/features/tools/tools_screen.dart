import 'package:flutter/material.dart';

import 'paint_calculator_screen.dart';
import 'steel_calculator_screen.dart';

/// أدوات مساعدة للمندوب (حاسبات الحديد والدهانات).
class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('أدوات مساعدة')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.calculate),
              title: const Text('حاسبة أوزان الحديد'),
              subtitle: const Text('قطر + طول + عدد ← وزن'),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const SteelCalculatorScreen()),
              ),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.format_paint),
              title: const Text('حاسبة كميات الدهانات'),
              subtitle: const Text('مساحة + وجوه + تغطية ← عدد العبوات'),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const PaintCalculatorScreen()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}