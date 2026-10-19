import '../../core/models.dart';
import '../../core/print/receipt.dart';

/// بطاقة مؤشر واحد في قسم «مؤشرات اليوم» (للاختبار كدوال نقية).
class KpiCard {
  final String label;
  final String value;
  final String? caption;
  final bool highlight;

  const KpiCard({
    required this.label,
    required this.value,
    this.caption,
    this.highlight = false,
  });
}

/// يحوّل مؤشرات اليوم إلى بطاقات العرض بترتيب المنطقي:
/// المبيعات، التحصيل، الزيارات، المسافة، ثم نسبة تحقيق الهدف (إن وُجد هدف).
List<KpiCard> todayKpiCards(TodayKpis k) => [
      KpiCard(
        label: 'مبيعات اليوم',
        value: fmtMoney(k.salesNet),
        caption: '${k.salesCount} بيان',
        highlight: true,
      ),
      KpiCard(
        label: 'تحصيل اليوم',
        value: fmtMoney(k.collected),
        caption: k.salesNet > 0
            ? 'نسبة التحصيل ${k.collectionRatePct.toStringAsFixed(0)}%'
            : null,
      ),
      KpiCard(
        label: 'زيارات اليوم',
        value: '${k.visitsDone} / ${k.visits}',
        caption: k.visitsMissed > 0 ? '${k.visitsMissed} فائتة' : null,
      ),
      KpiCard(
        label: 'المسافة',
        value: '${k.distanceKm.toStringAsFixed(1)} كم',
      ),
      if (k.targetAmount > 0)
        KpiCard(
          label: 'نسبة تحقيق الهدف',
          value: '${k.achievementPct.toStringAsFixed(0)}%',
          caption: 'الهدف ${fmtMoney(k.targetAmount)}',
        ),
    ];

/// تاريخ اليوم local بصيغة `yyyy-MM-dd` (مرشّح الفترة للخادم).
String dayFilter(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// هل تشير المؤشرات إلى فترتها نفسها (اليوم) — تمنع عرض كاش من يوم آخر.
bool isForToday(TodayKpis k, {DateTime? now}) => dayFilter(k.from) == dayFilter(now ?? DateTime.now());
