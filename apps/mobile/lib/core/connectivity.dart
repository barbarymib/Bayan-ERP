import 'package:connectivity_plus/connectivity_plus.dart';

/// تجريد حالة اتصال الجهاز بالشبكة (§5.12: رفع تلقائي عند توفر الاتصال).
/// يجعل منطق «الرفع عند عودة الاتصال» قابلاً للاختبار بعيداً عن قنوات المنصّة.
abstract class ConnectivityStatus {
  /// هل تتوفر شبكة الآن؟
  Future<bool> isOnline();

  /// بثّ التغيّرات: `true` عند توفر اتصال و`false` عند انقطاعه.
  Stream<bool> get onChanged;
}

/// هل تحتوي نتائج `connectivity_plus` على اتصال فعلي؟ (دالة نقية للاختبار).
bool connectivityIsOnline(List<ConnectivityResult> results) =>
    results.any((r) => r != ConnectivityResult.none);

/// التنفيذ الحقيقي فوق `connectivity_plus`.
class ConnectivityPlusStatus implements ConnectivityStatus {
  final Connectivity _connectivity;

  ConnectivityPlusStatus([Connectivity? connectivity])
      : _connectivity = connectivity ?? Connectivity();

  @override
  Future<bool> isOnline() async =>
      connectivityIsOnline(await _connectivity.checkConnectivity());

  @override
  Stream<bool> get onChanged =>
      _connectivity.onConnectivityChanged.map(connectivityIsOnline);
}
