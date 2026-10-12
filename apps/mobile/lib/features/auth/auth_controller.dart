import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/providers.dart';

enum AuthStatus { unauthenticated, authenticated }

class AuthState {
  final AuthStatus status;
  final AuthUser? user;
  final bool loading;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unauthenticated,
    this.user,
    this.loading = false,
    this.error,
  });

  AuthState copy({
    AuthStatus? status,
    AuthUser? user,
    bool? loading,
    String? error,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        loading: loading ?? this.loading,
        error: error,
      );
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final session = ref.read(sessionProvider);
    final user = session.user;
    if (session.isLoggedIn && user != null) {
      return AuthState(status: AuthStatus.authenticated, user: user);
    }
    return const AuthState();
  }

  Future<void> login({required String phone, required String password}) async {
    if (state.loading) return;
    state = state.copy(loading: true, error: null);
    final api = ref.read(apiClientProvider);
    final session = ref.read(sessionProvider);
    try {
      final user = await api.login(phone: phone, password: password);

      // تسجيل الجهاز إلزامي (§9/G4): ربط الجهاز بمستخدم واحد + فحص الجهاز النشط
      // على الخادم. فشله يمنع العمل (لا نُخفي الخطأ).
      var deviceId = session.deviceId;
      if (deviceId == null || deviceId.isEmpty) {
        deviceId = const Uuid().v4();
        await session.saveDeviceId(deviceId);
      }
      api.deviceId = deviceId;
      await api.registerDevice(deviceId: deviceId, deviceName: deviceId);

      await session.saveAuth(api.token!, user, refreshToken: api.refreshToken);
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on ApiException catch (e) {
      api.token = null;
      api.refreshToken = null;
      await session.clear();
      state = AuthState(
        status: AuthStatus.unauthenticated,
        error: 'فشل تسجيل الجهاز: ${e.message}',
      );
    } catch (e) {
      api.token = null;
      api.refreshToken = null;
      await session.clear();
      state = AuthState(status: AuthStatus.unauthenticated, error: e.toString());
    }
  }

  Future<void> logout() async {
    final session = ref.read(sessionProvider);
    final api = ref.read(apiClientProvider);
    api.token = null;
    api.refreshToken = null;
    await session.clear();
    state = const AuthState();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);