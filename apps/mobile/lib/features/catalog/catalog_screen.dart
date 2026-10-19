import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/print/receipt.dart';
import '../../core/providers.dart';
import '../../core/scan_resolver.dart';
import '../tools/scan_screen.dart';
import 'catalog_view.dart';

/// شاشة الأصناف والأسعار (§5.12): يستعرض المندوب أصنافه وأسعارها من البيانات
/// المنزّلة أوفلاين، مع قائمة الأسعار المختارة وعرض السعر عبر كل القوائم.
class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  String _query = '';
  int? _priceListId;
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// فحص باركود (صنف/وحدة) ثم حصر القائمة على الصنف المطابق (§9/G13).
  Future<void> _scan() async {
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute<String>(builder: (_) => const ScanScreen(title: 'فحص صنف')),
    );
    if (!mounted || code == null) return;
    final target = resolveScan(code, ref.read(dataStoreProvider).items);
    if (target == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لا يوجد صنف مطابق للباركود «$code»')),
      );
      return;
    }
    final unit = target.unit?.unitCode;
    _search.text = target.item.code;
    setState(() => _query = target.item.code);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${target.item.name}${unit == null ? '' : ' — وحدة $unit'}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(dataStoreProvider);
    final items = store.items;
    final lists = store.priceLists;
    final selected = _selectedList(lists);
    final filtered = filterItems(items, _query);

    return Scaffold(
      appBar: AppBar(title: const Text('الأصناف والأسعار')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                labelText: 'بحث بالاسم أو الكود',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: 'فحص باركود',
                  icon: const Icon(Icons.qr_code_scanner),
                  onPressed: _scan,
                ),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          if (lists.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: DropdownButtonFormField<int>(
                initialValue: selected?.id,
                decoration: const InputDecoration(labelText: 'قائمة الأسعار'),
                items: lists
                    .map((l) => DropdownMenuItem(value: l.id, child: Text(l.name)))
                    .toList(),
                onChanged: (v) => setState(() => _priceListId = v),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                Text('${filtered.length} صنف',
                    style: Theme.of(context).textTheme.bodySmall),
                const Spacer(),
                if (selected != null)
                  Text('الأسعار: ${selected.name}',
                      style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? _empty('لا توجد أصناف. نزّل البيانات ثم أعد المحاولة.')
                : ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) => _itemTile(
                      context,
                      filtered[index],
                      lists,
                      selected,
                      store.stockQty(filtered[index].id),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  PriceListSummary? _selectedList(List<PriceListSummary> lists) {
    if (lists.isEmpty) return null;
    if (_priceListId == null) return lists.first;
    for (final l in lists) {
      if (l.id == _priceListId) return l;
    }
    return lists.first;
  }

  Widget _itemTile(
    BuildContext context,
    ItemSummary item,
    List<PriceListSummary> lists,
    PriceListSummary? selected,
    double stockQty,
  ) {
    final theme = Theme.of(context);
    final price = priceInList(selected, item.id);
    final range = priceRange(lists, item.id);
    return Card(
      child: ListTile(
        leading: const CircleAvatar(child: Icon(Icons.inventory_2_outlined)),
        title: Text(item.name),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              [
                item.code,
                if (item.baseUnit != null && item.baseUnit!.isNotEmpty) item.baseUnit!,
                if (range != null && range.min != range.max)
                  'المدى: ${fmtMoney(range.min)} - ${fmtMoney(range.max)}',
              ].join(' · '),
              style: theme.textTheme.bodySmall,
            ),
            // R3-F2 §8.2 #7: رصيد الصنف (مركّب حسب وحداته) مع آخر تحديث للمزامنة.
            Text(
              'الرصيد: ${stockLabel(item, stockQty)}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        trailing: Text(
          price == null ? '—' : fmtMoney(price),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        onTap: () => _showPrices(context, item, lists),
      ),
    );
  }

  void _showPrices(BuildContext context, ItemSummary item, List<PriceListSummary> lists) {
    final rows = pricesForItem(lists, item.id);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name, style: Theme.of(ctx).textTheme.titleMedium),
              Text('${item.code}${item.baseUnit != null ? ' · ${item.baseUnit}' : ''}',
                  style: Theme.of(ctx).textTheme.bodySmall),
              const SizedBox(height: 8),
              if (rows.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Text('لا يوجد سعر لهذا الصنف في قوائم الأسعار.'),
                )
              else
                for (final r in rows)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.sell_outlined),
                    title: Text(r.priceListName),
                    trailing: Text(fmtMoney(r.price),
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _empty(String message) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center),
            ],
          ),
        ),
      );
}
