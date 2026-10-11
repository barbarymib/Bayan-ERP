import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';

enum _GateStatus { loading, granted, blocked }

/// بوابة إجبارية عند تشغيل التطبيق: لا يُستكمل العمل دون
/// إذن موقع وتفعيل الخدمة (شرط تتبع وردية المندوب §5.13).
class LocationGate extends ConsumerStatefulWidget {
  final Widget child;
  const LocationGate({super.key, required this.child});

  @override
  ConsumerState<LocationGate> createState() => _LocationGateState();
}

class _LocationGateState extends ConsumerState<LocationGate>
    with WidgetsBindingObserver {
  _GateStatus _status = _GateStatus.loading;
  String _reason = '';
  bool _serviceDisabled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// إعادة الفحص عند العودة من الإعدادات (بعد منح الإذن تعمل مباشرة).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    final loc = ref.read(locationProvider);
    _status = _GateStatus.loading;
    setState(() {});

    if (!await loc.isLocationEnabled()) {
      if (!mounted) return;
      setState(() {
        _status = _GateStatus.blocked;
        _serviceDisabled = true;
        _reason = 'خدمة الموقع (GPS) موقوفة على الجهاز؛ فعّلها لمتابعة العمل.';
      });
      return;
    }
    if (_serviceDisabled) _serviceDisabled = false;

    if (!await loc.ensurePermission()) {
      if (!mounted) return;
      setState(() {
        _status = _GateStatus.blocked;
        _serviceDisabled = false;
        _reason = 'أذِن للتطبيق باستخدام موقعك من الإعدادات — بدون هذا الإذن لا يمكن العمل.';
      });
      return;
    }

    if (!mounted) return;
    setState(() => _status = _GateStatus.granted);
  }

  @override
  Widget build(BuildContext context) {
    switch (_status) {
      case _GateStatus.granted:
        return widget.child;
      case _GateStatus.loading:
        return Scaffold(
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                Text('جارِ التحقق من الموقع…', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
          ),
        );
      case _GateStatus.blocked:
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.location_off, size: 56, color: Theme.of(context).colorScheme.error),
                    const SizedBox(height: 16),
                    Text('الوصول للموقع مطلوب',
                        style: Theme.of(context).textTheme.titleLarge,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    Text(_reason,
                        textAlign: TextAlign.center,
                        style: const TextStyle(height: 1.5)),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: _check,
                      icon: const Icon(Icons.refresh),
                      label: const Text('إعادة المحاولة'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _serviceDisabled
                          ? () => ref.read(locationProvider).openLocationSettings()
                          : () => ref.read(locationProvider).openAppSettings(),
                      icon: Icon(_serviceDisabled ? Icons.gps_fixed : Icons.settings),
                      label: Text(_serviceDisabled ? 'تفعيل الموقع' : 'فتح إعدادات التطبيق'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
    }
  }
}