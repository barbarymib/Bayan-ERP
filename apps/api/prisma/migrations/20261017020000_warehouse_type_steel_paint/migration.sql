-- R3-C16 (§5.7): warehouses are multi-type (رئيسي، حديد، بويات، سيارة مندوب، معرض...).
-- Add the two specialized store types named by the spec while keeping the existing ones.
ALTER TYPE public."WarehouseType" ADD VALUE IF NOT EXISTS 'STEEL';
ALTER TYPE public."WarehouseType" ADD VALUE IF NOT EXISTS 'PAINT';
