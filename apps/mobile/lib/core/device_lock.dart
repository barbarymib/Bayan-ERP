import 'package:local_auth/local_auth.dart';

/// قفل الجهاز (§9/G4): يطلب مصادقة بيومترية أو بيانات الجهاز قبل فتح التطبيق.
///
/// يُجرّد خلف واجهة بسيطة حتى يمكن اختبار البوابة [DeviceLockGate] بنسخة زائفة
/// بعيداً عن قنوات المنصّة.
abstract class DeviceLock {
  /// هل تتوفر وسيلة تحقق مدعومة على الجهاز (بيومتري أو بيانات الجهاز)؟
  Future<bool> isAvailable();

  /// يطلب المصادقة؛ يُرجع `true` عند النجاح.
  Future<bool> authenticate({String reason});
}

/// التنفيذ الحقيقي فوق `local_auth`.
class LocalAuthDeviceLock implements DeviceLock {
  final LocalAuthentication _auth;

  LocalAuthDeviceLock([LocalAuthentication? auth])
      : _auth = auth ?? LocalAuthentication();

  @override
  Future<bool> isAvailable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      if (!supported) return false;
      final types = await _auth.getAvailableBiometrics();
      final canCheck = await _auth.canCheckBiometrics;
      return canCheck || types.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticate({String reason = 'أكّد هويتك لفتح التطبيق'}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
