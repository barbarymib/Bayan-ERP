-- G6: عزل المستأجرين على مستوى الصفوف (Postgres RLS) §12.
-- كل جدول يحمل companyId (عدا User و CompanyFeature المُستثنيين) يُقيّد تلقائيًا
-- بالشركة المثبّتة في الإعداد app.current_company_id، مع الإغلاق الافتراضي عند غيابه.

CREATE SCHEMA IF NOT EXISTS bayan;

-- الشركة الحالية للجلسة/المعاملة؛ ترجع NULL عند عدم الضبط ('' أو غياب الإعداد) → إغلاق افتراضي.
CREATE OR REPLACE FUNCTION bayan.current_company_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::bigint
$$;

COMMENT ON FUNCTION bayan.current_company_id() IS
  'معرّف الشركة الحالية لسياسات RLS؛ NULL عند عدم الضبط (إغلاق افتراضي).';

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Category', 'Brand', 'Item', 'PriceList', 'ItemPrice', 'PriceHistory',
    'Customer', 'CustomerRepAssignment', 'Supplier', 'Warehouse',
    'StockBalance', 'StockMovement', 'StockReservation', 'Period',
    'OpeningBalance', 'NumberBlock', 'PriceStatement', 'ReturnStatement',
    'PurchaseStatement', 'Receipt', 'Payment', 'Cheque', 'Approval',
    'LedgerEntry', 'StocktakeSession', 'DeviceRegistration', 'RepShift',
    'RepLocation', 'RepVisit', 'Branch', 'Quotation', 'CustomerGroup',
    'SpecialPrice', 'RepTarget', 'StockTransfer', 'PurchaseOrder',
    'SupplierReturn', 'CashAccount', 'CustodyHandover', 'DailyClose', 'VisitPlan'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("companyId" = bayan.current_company_id()) '
      'WITH CHECK ("companyId" = bayan.current_company_id())',
      t
    );
  END LOOP;
END $$;
