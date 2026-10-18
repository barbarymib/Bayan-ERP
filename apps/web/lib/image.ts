'use client';

/** يحوّل ملف صورة إلى data URL JPEG مصغّر (≤maxDim بكسل، جودة quality) لرفعه للخادم. */
export async function fileToDataUrl(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('الملف المختار ليس صورة');
  if (file.size > 20 * 1024 * 1024) throw new Error('حجم الصورة كبير جداً (الحد 20MB)');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذّر معالجة الصورة في هذا المتصفح');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
