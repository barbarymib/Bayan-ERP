import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'auth_controller.dart';

/// دالة نقية: هل يجب قفل التطبيق عند الإقلاع؟ (§9/G4)
bool shouldLockOnStart({required bool isLoggedIn, required bool lockEnabled}) =>
    isLoggedIn && lockEnabled;

/// بوابة قفل الجهاز: تفرض مصادقة بيومترية/بيانات الجهاز عند الإقلاع وعند العودة
/// من الخلفية عندما يكون القفل مُفعّلاً. عند تعذّر المصادقة يبقى التطبيق مقفلاً
/// مع زر إعادة المحاولة وتسجيل الخروج. إن لم تتوفر أي وسيلة تحقق لا يُحبس
/// المستخدم خارج التطبيق.
class DeviceLockGate extends ConsumerStatefulWidget {
  const DeviceLockGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<DeviceLockGate> createState() => _DeviceLockGateState();
}

class _DeviceLockGateState extends ConsumerState<DeviceLockGate>
    with WidgetsBindingObserver {
  bool _locked = false;
  bool _checking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final session = ref.read(sessionProvider);
    _locked = shouldLockOnStart(
      isLoggedIn: session.isLoggedIn,
      lockEnabled: session.deviceLockEnabled,
    );
    if (_locked) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final session = ref.read(sessionProvider);
    if (state == AppLifecycleState.paused) {
      if (session.isLoggedIn && session.deviceLockEnabled && !_locked) {
        setState(() => _locked = true);
      }
    } else if (state == AppLifecycleState.resumed && _locked) {
      _unlock();
    }
  }

  Future<void> _unlock() async {
    if (_checking) return;
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      final lock = ref.read(deviceLockProvider);
      final available = await lock.isAvailable();
      if (!available) {
        if (mounted) setState(() => _locked = false);
        return;
      }
      final ok = await lock.authenticate(reason: 'أكّد هويتك لفتح التطبيق');
      if (!mounted) return;
      setState(() {
        _locked = !ok;
        _error = ok ? null : 'تعذّر التحقق — أعد المحاولة';
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'تعذّر التحقق — أعد المحاولة');
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _logout() async {
    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) setState(() => _locked = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!_locked) return widget.child;
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 64),
              const SizedBox(height: 16),
              const Text('التطبيق مقفل', style: TextStyle(fontSize: 20)),
              const SizedBox(height: 8),
              Text(
                'أكّد هويتك للمتابعة',
                style: TextStyle(color: Theme.of(context).hintColor),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _checking ? null : _unlock,
                icon: const Icon(Icons.fingerprint),
                label: Text(_checking ? 'جارٍ التحقق…' : 'فتح'),
              ),
              const SizedBox(height: 8),
              TextButton(onPressed: _checking ? null : _logout, child: const Text('تسجيل الخروج')),
            ],
          ),
        ),
      ),
    );
  }
}
