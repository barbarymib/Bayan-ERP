/**
 * R4-B10 (§9): حماية تقارير التحليلات الثقيلة أثناء الانفجارات المتزامنة.
 *
 * - `singleFlight` / `ttlCache`: يدمج الطلبات المتطابقة المتزامنة في تنفيذ
 *   واحد ويشارك النتيجة لفترة قصيرة (TTL) — فانفجار من 50 طلباً متطابقاً
 *   لا يُثقل قاعدة البيانات سوى مرة واحدة.
 * - `createGate`: سيمافور يحدّ عدد الاستعلامات الثقيلة المتوازية عبر جميع
 *   المستأجرين، فيمنع استنزاف مجمّع الاتصالات تحت حمل متزامن متنوّع.
 */

type Entry<T> = { value: Promise<T>; expiresAt: number };

export function createReportCache(ttlMs = 2000) {
  const store = new Map<string, Entry<unknown>>();

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = store.get(key) as Entry<T> | undefined;
    if (hit && hit.expiresAt > now) return hit.value;

    const value = fn();
    store.set(key, { value, expiresAt: now + ttlMs });
    try {
      return await value;
    } catch (err) {
      // لا نُبقي الأخطاء مخزّنة — الطلب التالي يعيد المحاولة.
      store.delete(key);
      throw err;
    }
  }

  function clear(): void {
    store.clear();
  }

  return { run, clear };
}

/** سيمافور بسيط يحدّ التزامن ويحترم طابور الانتظار (FIFO). */
export function createGate(maxConcurrent: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  function release(): void {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  }

  async function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      queue.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return { run };
}
