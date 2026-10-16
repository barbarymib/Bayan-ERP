import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'connectivity.dart';
import 'data_store.dart';
import 'device_lock.dart';
import 'geo/location.dart';
import 'geo/tracking_notification.dart';
import 'numbering_store.dart';
import 'outbox.dart';
import 'print/printer.dart';
import 'session_store.dart';

/// عنوان الـ API الافتراضي (يمكن تمريره عند البناء عبر `--dart-define=API_BASE=...`).
/// `10.0.2.2` يشير إلى حاسب المضيف من أندرويد emulator.
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:3000/api');

final sessionProvider = Provider<SessionStore>((ref) => throw UnimplementedError());
final dataStoreProvider = Provider<DataStore>((ref) => throw UnimplementedError());
final apiClientProvider = Provider<ApiClient>((ref) => throw UnimplementedError());
final outboxProvider = Provider<Outbox>((ref) => throw UnimplementedError());
final numberingProvider = Provider<NumberingStore>((ref) => throw UnimplementedError());

/// حالة الاتصال بالشبكة — تُستبدل بنسخة زائفة في الاختبارات (§5.12).
final connectivityProvider =
    Provider<ConnectivityStatus>((ref) => throw UnimplementedError());

/// مصدر الموقع — يُستبدل بإصدار حقيقي في `main()` وبنسخة زائفة في الاختبارات.
final locationProvider = Provider<LocationProvider>((ref) => throw UnimplementedError());

/// المؤشر المرئي للتتبع (§5.13) — إشعار دائم/خدمة مقدمة على أندرويد؛
/// يُستبدل بنسخة حقيقية في `main()` وبنسخة صامتة في الاختبارات.
final trackingNotifierProvider =
    Provider<TrackingNotifier>((ref) => throw UnimplementedError());

/// طابعة البلوتوث الحرارية — تُستبدل بتنفيذ حقيقي في `main()` وبنسخة زائفة في
/// الاختبارات.
final bluetoothPrinterProvider =
    Provider<BluetoothPrinter>((ref) => throw UnimplementedError());

/// قفل الجهاز (§9/G4) — يُستبدل بتنفيذ حقيقي في `main()` وبنسخة زائفة في الاختبارات.
final deviceLockProvider = Provider<DeviceLock>((ref) => throw UnimplementedError());

/// الفاصل الزمني لإرسال نقاط الموقع أثناء الوردية (§5.13: 30–120 ثانية).
final trackingIntervalProvider = Provider<Duration>((ref) => const Duration(seconds: 60));