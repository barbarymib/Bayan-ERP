-- R4-C2: معرض صور الصنف (§5.1 «صور للصنف») — الصورة الرئيسية تبقى "Item"."imageUrl"
-- (جداول أحادية العمود: تُكتب schema-qualify لتفادي هبوطها في س bayan — انظر ملاحظة الترحيل في docs/GAP.md)

CREATE TABLE public."ItemImage" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemImage_itemId_sortOrder_idx" ON public."ItemImage"("itemId", "sortOrder");

ALTER TABLE public."ItemImage" ADD CONSTRAINT "ItemImage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;
