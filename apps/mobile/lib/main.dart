import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/api_client.dart';
import 'core/connectivity.dart';
import 'core/data_store.dart';
import 'core/db/database.dart';
import 'core/geo/location.dart';
import 'core/geo/location_gate.dart';
import 'core/numbering_store.dart';
import 'core/outbox.dart';
import 'core/print/printer.dart';
import 'core/providers.dart';
import 'core/session_store.dart';
import 'core/theme.dart';
import 'features/auth/auth_controller.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();

  final session = SessionStore(prefs);
  final db = AppDatabase();
  final store = DataStore(db);
  await store.init();
  final numberer = NumberingStore(prefs);
  final api = ApiClient(baseUrl: apiBase);
  api.token = session.token;
  api.refreshToken = session.refreshToken;
  api.onRefreshed = (access, refresh) => session.saveTokens(access, refresh);
  final outbox = Outbox.fromJson(session.outboxJson);

  runApp(
    ProviderScope(
      overrides: [
        sessionProvider.overrideWithValue(session),
        dataStoreProvider.overrideWithValue(store),
        apiClientProvider.overrideWithValue(api),
        outboxProvider.overrideWithValue(outbox),
        numberingProvider.overrideWithValue(numberer),
        locationProvider.overrideWithValue(GeolocatorLocationProvider()),
        connectivityProvider.overrideWithValue(ConnectivityPlusStatus()),
        bluetoothPrinterProvider.overrideWithValue(const BluetoothPrintPlusPrinter()),
      ],
      child: const BayanApp(),
    ),
  );
}

class BayanApp extends ConsumerWidget {
  const BayanApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'بيان — تطبيق المندوب',
      debugShowCheckedModeBanner: false,
      theme: BayanTheme.light(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      // إذن الموقع إلزامي لتشغيل التطبيق — البوابة تغطي شاشة الدخول أيضاً.
      home: const LocationGate(child: _AuthRoot()),
    );
  }
}

class _AuthRoot extends ConsumerWidget {
  const _AuthRoot();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final authenticated = auth.status == AuthStatus.authenticated;
    return authenticated ? const HomeScreen() : const LoginScreen();
  }
}