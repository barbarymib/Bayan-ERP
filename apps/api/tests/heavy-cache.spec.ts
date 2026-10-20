import { describe, expect, it, vi } from 'vitest';
import { createGate, createReportCache } from '../src/common/heavy-cache.js';

describe('heavy-cache — createReportCache (R4-B10 §9)', () => {
  it('يدمج الطلبات المتطابقة المتزامنة في تنفيذ واحد (single-flight)', async () => {
    const cache = createReportCache(1000);
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    });
    const [a, b, c] = await Promise.all([
      cache.run('k', fn),
      cache.run('k', fn),
      cache.run('k', fn),
    ]);
    expect([a, b, c]).toEqual([42, 42, 42]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('يعيد النتيجة المخزّنة خلال مدة الصلاحية دون إعادة التنفيذ', async () => {
    const cache = createReportCache(1000);
    const fn = vi.fn(async () => 'v');
    await cache.run('k', fn);
    await cache.run('k', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('يعيد التنفيذ بعد انتهاء الصلاحية', async () => {
    const cache = createReportCache(10);
    const fn = vi.fn(async () => 'v');
    await cache.run('k', fn);
    await new Promise((r) => setTimeout(r, 25));
    await cache.run('k', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('لا يخزّن الأخطاء ويعيد المحاولة في الطلب التالي', async () => {
    const cache = createReportCache(1000);
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(cache.run('k', fn)).rejects.toThrow('boom');
    await expect(cache.run('k', fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('يميّز المفاتيح المختلفة', async () => {
    const cache = createReportCache(1000);
    const fn = vi.fn(async (n: number) => n);
    await cache.run('a', () => fn(1));
    await cache.run('b', () => fn(2));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('heavy-cache — createGate (R4-B10 §9)', () => {
  it('يحدّ عدد التنفيذات المتزامنة', async () => {
    const gate = createGate(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      gate.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 15));
        active -= 1;
      });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('ينفّذ كل المهام في النهاية', async () => {
    const gate = createGate(1);
    const done: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        gate.run(async () => {
          await new Promise((r) => setTimeout(r, 5));
          done.push(n);
        }),
      ),
    );
    expect(done.sort()).toEqual([1, 2, 3]);
  });

  it('يحرّر الفتحة عند فشل المهمة', async () => {
    const gate = createGate(1);
    await expect(gate.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    const ok = await gate.run(async () => 'fine');
    expect(ok).toBe('fine');
  });
});
