export type WhatsAppLink = { url: string | null; phone: string | null; text: string };

type SharePayload = ShareData & { files?: File[] };

export type ShareOutcome = 'shared' | 'fallback' | 'no-phone';

/**
 * مشاركة ملف عبر واتساب (G18):
 * - إن أيدِي المتصفح مشاركة الملفات (هاتف/سطح مكتب) → Web Share API بالملف + النص.
 * - وإلا نُعيد 'fallback' ليستدعي النازل تنزيل PDF وفتح رابط wa.me (لا ترفيع عبر wa.me مباشرة).
 */
export async function shareFileOrWhatsApp(opts: {
  text: string;
  url: string | null;
  file: File;
}): Promise<ShareOutcome> {
  const nav = navigator as Navigator & {
    canShare?: (data?: SharePayload) => boolean;
    share?: (data?: SharePayload) => Promise<void>;
  };
  if (nav.canShare?.({ files: [opts.file] }) && nav.share) {
    try {
      await nav.share({ files: [opts.file], text: opts.text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // مشاركة الملفات فشلت (بدون إلغاء المستخدم) → نسقط للخيار النصي
    }
  }
  if (!opts.url) return 'no-phone';
  return 'fallback';
}

/** تنزيل ملف من الذاكرة عبر رابط مؤقت. */
export function downloadBlob(file: File): void {
  const href = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}
