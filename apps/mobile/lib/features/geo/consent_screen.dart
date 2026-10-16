import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/geo/tracking_consent.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// شاشة الإقرار على تتبع الموقع (§5.13 / قانون حماية البيانات 151/2020).
///
/// تعرض إشعار الخصوصية بوضوح، وتتيح للمندوب التوقيع بالاسم الكامل (توقيع
/// إلكتروني) قبل بدء الوردية، أو سحب الإقرار لاحقاً. تُرجع `true` عند نجاح
/// التسجيل ليتابع المستدعي بدء الوردية.
class GeoConsentScreen extends ConsumerStatefulWidget {
  const GeoConsentScreen({super.key});

  @override
  ConsumerState<GeoConsentScreen> createState() => _GeoConsentScreenState();
}

class _GeoConsentScreenState extends ConsumerState<GeoConsentScreen> {
  final _name = TextEditingController();
  bool _agreed = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final consent = ref.read(sessionProvider).geoConsent;
    if (consent != null) _name.text = consent.signatureName;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'اكتب اسمك الكامل للتوقيع على الإقرار');
      return;
    }
    if (!_agreed) {
      setState(() => _error = 'يجب تحديد مربع الموافقة');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).acceptGeoConsent(
            version: geoConsentVersion,
            signatureName: name,
          );
      final acceptedAt =
          DateTime.tryParse((res['record']?['acceptedAt'] ?? '').toString())?.toUtc() ??
              DateTime.now().toUtc();
      await ref.read(sessionProvider).saveGeoConsent(
            GeoConsent(
              version: geoConsentVersion,
              signatureName: name,
              acceptedAt: acceptedAt,
              deviceId: ref.read(sessionProvider).deviceId,
            ),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _busy = false;
        _error = 'تعذّر تسجيل الإقرار — تحقّق من الاتصال. ($e)';
      });
    }
  }

  Future<void> _revoke() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('سحب الإقرار'),
        content: const Text(
            'سيؤدي سحب الإقرار إلى إيقاف تتبع موقعك وإنهاء أي وردية نشطة. هل تريد المتابعة؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('سحب')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).revokeGeoConsent();
      await ref.read(sessionProvider).clearGeoConsent();
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('تم سحب الإقرار وإيقاف التتبع')));
    } catch (e) {
      setState(() {
        _busy = false;
        _error = 'تعذّر سحب الإقرار — تحقّق من الاتصال. ($e)';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final consent = ref.watch(sessionProvider).geoConsent;

    return Scaffold(
      appBar: AppBar(title: const Text('الإقرار على تتبع الموقع')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.privacy_tip_outlined,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      Text('إشعار الخصوصية',
                          style: Theme.of(context).textTheme.titleMedium),
                      const Spacer(),
                      Chip(
                        label: Text('النسخة $geoConsentVersion'),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'يوافق المندوب على تتبّع موقعه الجغرافي أثناء وردية العمل فقط، '
                    'وذلك لأغراض تنظيم خط السير، وتأكيد زيارات العملاء، وربط الموقع '
                    'بالمستندات (البيانات/التحصيل) ضمن نطاق 150 متراً.',
                    style: TextStyle(height: 1.6),
                  ),
                  const SizedBox(height: 12),
                  const Text('بنود هامة:', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const _Bullet('لا يُتبَّع المندوب خارج ساعات الوردية.'),
                  const _Bullet('يظهر مؤشر مرئي دائم على الجهاز يُفيد بأن التتبع مُفعّل.'),
                  const _Bullet('تُحفظ سجلات الموقع 90 يوماً ثم تُحذف تلقائياً.'),
                  const _Bullet('يمكن للمندوب سحب إقراره في أي وقت فيتوقف التتبع فوراً.'),
                  const _Bullet(
                      'يُعالَج هذا الإقرار وفق قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020.'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (consent != null && consent.isCurrent)
            Card(
              color: BayanTheme.uploadedColor.withValues(alpha: 0.12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.check_circle_outline, color: BayanTheme.uploadedColor),
                        const SizedBox(width: 8),
                        Text('إقرار مُوقّع', style: Theme.of(context).textTheme.titleMedium),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('الاسم: ${consent.signatureName}'),
                    Text('تاريخ الإقرار: ${consent.acceptedAt.toLocal().toString().substring(0, 19)}'),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _revoke,
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('سحب الإقرار'),
                    ),
                  ],
                ),
              ),
            )
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('التوقيع على الإقرار',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _name,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'الاسم الكامل (توقيع إلكتروني)',
                        prefixIcon: Icon(Icons.draw_outlined),
                      ),
                    ),
                    const SizedBox(height: 8),
                    CheckboxListTile(
                      value: _agreed,
                      onChanged: (v) => setState(() => _agreed = v ?? false),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      title: const Text('قرأت الإشعار وأوافق على تتبع موقعي أثناء الوردية'),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    ],
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _busy ? null : _accept,
                      icon: _busy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.verified_outlined),
                      label: Text(_busy ? 'جارٍ التسجيل…' : 'توقيع الإقرار والمتابعة'),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  final String text;
  const _Bullet(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('•  '),
            Expanded(child: Text(text, style: const TextStyle(height: 1.5))),
          ],
        ),
      );
}
