import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/geo/location.dart';
import '../../core/geo/shift_controller.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/print/receipt.dart';
import '../../core/theme.dart';

/// شاشة "عملائي" (§8.2 #2) — بحث + فلتر + مسافة من الموقع الحالي
class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  String _query = '';
  bool _onlyWithLocation = false;
  bool _sortByDistance = false;
  GeoPosition? _lastPos;

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(dataStoreProvider);
    final shift = ref.watch(shiftControllerProvider);
    _lastPos = shift.lastPosition ?? _lastPos;

    final customers = store.customers;

    // فلترة
    final filtered = customers.where((c) {
      if (_onlyWithLocation && (c.lat == null || c.lng == null)) {
        return false;
      }

      if (_query.isEmpty) return true;
      final q = _query.trim().toLowerCase();
      if (q.isEmpty) return true;

      if (c.code.toLowerCase().contains(q)) return true;
      if (c.name.toLowerCase().contains(q)) return true;
      if (c.phone?.toLowerCase().contains(q) == true) return true;
      return false;
    }).toList();

    // ترتيب
    if (_sortByDistance && _lastPos != null) {
      filtered.sort((a, b) {
        double da = double.infinity;
        double db = double.infinity;
        if (a.lat != null && a.lng != null) {
          da = distanceMeters(_lastPos!, GeoPosition(lat: a.lat!, lng: a.lng!, capturedAt: DateTime.now()));
        }
        if (b.lat != null && b.lng != null) {
          db = distanceMeters(_lastPos!, GeoPosition(lat: b.lat!, lng: b.lng!, capturedAt: DateTime.now()));
        }
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => a.name.compareTo(b.name));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('عملائي'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'بحث بالاسم أو الكود أو الهاتف',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('ترتيب حسب المسافة'),
                  selected: _sortByDistance,
                  onSelected: (v) => setState(() => _sortByDistance = v),
                ),
                FilterChip(
                  label: const Text('لديهم إحداثيات فقط'),
                  selected: _onlyWithLocation,
                  onSelected: (v) => setState(() => _onlyWithLocation = v),
                ),
                if (_lastPos != null)
                  Chip(
                    label: Text(
                      'آخر موقع: ${_lastPos!.lat.toStringAsFixed(4)}, ${_lastPos!.lng.toStringAsFixed(4)}',
                      style: const TextStyle(fontSize: 11),
                    ),
                    avatar: const Icon(Icons.gps_fixed, size: 16),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: filtered.isEmpty
                ? const Center(child: Text('لا يوجد عملاء مطابقون'))
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, i) => _customerTile(context, filtered[i], _lastPos),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _customerTile(BuildContext context, CustomerSummary c, GeoPosition? pos) {
    double? distKm;
    if (pos != null && c.lat != null && c.lng != null) {
      final m = distanceMeters(
        pos,
        GeoPosition(lat: c.lat!, lng: c.lng!, capturedAt: DateTime.now()),
      );
      distKm = m / 1000.0;
    }

    return Card(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 6),
      child: ListTile(
        title: Text(c.name),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('الكود: ${c.code}${c.phone == null || c.phone!.isEmpty ? '' : ' · الهاتف: ${c.phone}'}'),
            if (c.balance != 0)
              Text(
                'الرصيد: ${fmtMoney(c.balance)}',
                style: TextStyle(
                  color: c.balance > 0 ? BayanTheme.pendingReviewColor : BayanTheme.uploadedColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            if (distKm != null)
              Text(
                'المسافة: ${distKm.toStringAsFixed(2)} كم',
                style: TextStyle(color: Theme.of(context).colorScheme.primary),
              ),
          ],
        ),
        trailing: (c.lat != null && c.lng != null)
            ? Icon(Icons.location_on_outlined, color: Theme.of(context).colorScheme.primary)
            : const Icon(Icons.location_off_outlined),
        dense: false,
      ),
    );
  }
}
