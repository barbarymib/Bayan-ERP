-- R3-C5 (§5.8.3): دعم أكثر من عداد للجرد — معرّف/اسم العداد + آخر من أدخل العد.
-- ملاحظة النشر: نُؤهّل الجدول بـ `public.` لتجاوز مسار البحث؛ دور `bayan` على السيرفر
-- يستعمل search_path = `bayan, public`، لذا ALTER غير مُؤهّل قد يخطئ الجدول في schema `bayan`.

ALTER TABLE public."StocktakeLine" ADD COLUMN "counter" TEXT;
ALTER TABLE public."StocktakeLine" ADD COLUMN "countedById" INTEGER;

ALTER TABLE public."StocktakeLine" ADD CONSTRAINT "StocktakeLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
