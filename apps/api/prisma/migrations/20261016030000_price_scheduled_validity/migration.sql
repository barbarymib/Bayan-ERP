-- R3-A7 (§5.3): a scheduled price must be able to coexist with the current
-- price. Drop the one-row-per-(item, unit, price list) unique index and
-- replace it with a non-unique lookup index so validity windows can stack.
DROP INDEX IF EXISTS public."ItemPrice_itemId_unitId_priceListId_key";

CREATE INDEX IF NOT EXISTS "ItemPrice_itemId_unitId_priceListId_validFrom_idx"
  ON public."ItemPrice" ("itemId", "unitId", "priceListId", "validFrom");
