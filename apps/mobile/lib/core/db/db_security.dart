import 'dart:ffi';
import 'dart:io';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sqlcipher_flutter_libs/sqlcipher_flutter_libs.dart';
import 'package:sqlite3/open.dart';
import 'package:sqlite3/sqlite3.dart';

/// مفتاح تشفير قاعدة البيانات داخل Keystore/Keychain (§9).
const kDbKeyStorageKey = 'bayan.db.key.v1';

/// طول المفتاح بالحروف (32 بايت → 64 محرفاً hex).
const kDbKeyHexLength = 64;

const _sqliteHeader = 'SQLite format 3\u0000';

/// يولّد مفتاح تشفير عشوائياً (32 بايت) بصيغة hex — يُمرَّر لـ SQLCipher كمفتاح خام.
String generateDbKey([Random? random]) {
  final r = random ?? Random.secure();
  final bytes = List<int>.generate(32, (_) => r.nextInt(256));
  return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// هل التشفير متاح على النظام الحالي؟ (الديسكتوب للتطوير/الاختبار بلا SQLCipher).
bool get dbCipherSupported =>
    Platform.isAndroid || Platform.isIOS || Platform.isMacOS;

/// يفعّل تشغيل مكتبة SQLCipher بدل مكتبة sqlite العادية.
Future<void> configureDbCipher() async {
  if (Platform.isAndroid) {
    await applyWorkaroundToOpenSqlCipherOnOldAndroidVersions();
    open.overrideFor(OperatingSystem.android, openCipherOnAndroid);
  } else if (Platform.isIOS || Platform.isMacOS) {
    // على iOS/macOS تُربط مكتبة sqlcipher داخل التطبيق وتُفتح من العملية نفسها.
    open.overrideFor(OperatingSystem.iOS, () => DynamicLibrary.process());
    open.overrideFor(OperatingSystem.macOS, () => DynamicLibrary.process());
  }
}

/// PRAGMA تفعيل مفتاح قاعدة البيانات (المفتاح بصيغة raw hex).
String cipherKeyPragma(String keyHex) => 'PRAGMA key = "x\'$keyHex\'"';

/// يضمن وجود مفتاح التشفير في التخزين الآمن ويُرجع قيمته.
Future<String> ensureDbKey(FlutterSecureStorage secure) async {
  final existing = await secure.read(key: kDbKeyStorageKey);
  if (existing != null && existing.length == kDbKeyHexLength) return existing;
  final fresh = generateDbKey();
  await secure.write(key: kDbKeyStorageKey, value: fresh);
  return fresh;
}

String _legacyPath(String path) => '$path.legacy';

/// يهيّئ ملف قاعدة البيانات للتشفير:
/// - ملف جديد: يبقى فارغاً ويُفعَّل المفتاح عند الفتح عبر `NativeDatabase`.
/// - ملف مشفّر أصلاً: لا شيء (الفتح بالمفتاح ينجح؛ محاولة `cipher_migrate` احتياطاً).
/// - ملف قديم غير مشفّر: ننقله جانباً (احتفاظ للاسترجاع) ونبدأ بقاعدة نظيفة
///   مشفّرة يعيد التطبيق مزامنتها من الخادم (§9).
Future<void> migrateLegacyFileIfNeeded(File file, String keyHex) async {
  if (!file.existsSync()) return;

  final probe = sqlite3.open(file.path);
  try {
    probe.execute(cipherKeyPragma(keyHex));
    probe.execute('SELECT count(*) FROM sqlite_master;');
    probe.execute('PRAGMA cipher_migrate;');
    return;
  } catch (_) {
    // الملف غير مشفّر بالمفتاح الحالي (قديم/خام) — نعالجه أدناه.
  } finally {
    probe.dispose();
  }

  // ملف خام قديم من نسخة سابقة: انتبذ عنه وهكّي قاعدة جديدة مشفّرة.
  final legacy = await _preserveLegacy(file);
  if (legacy != null) {
    // إعادة محاولة الفتح الآن تنجح لأن الملف القديم أُزيح — يُترك ملف مشفّر جديد
    // يبنيه NativeDatabase عند أول فتح.
  }
}

Future<File?> _preserveLegacy(File file) async {
  // لا نحمي إلا الملفات التي تبدو فعلاً قواعد sqlite خام (تحقق من الترويسة).
  final raf = file.openSync(mode: FileMode.read);
  try {
    final head = raf.readSync(16);
    final looksPlain =
        head.length == 16 && String.fromCharCodes(head) == _sqliteHeader;
    if (!looksPlain) return null;
  } finally {
    raf.closeSync();
  }

  final bak = File(_legacyPath(file.path));
  if (bak.existsSync()) bak.deleteSync();
  await file.rename(bak.path);
  return bak;
}