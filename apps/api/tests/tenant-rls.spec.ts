import { describe, expect, it, vi } from 'vitest';
import { currentCompanyId, runWithTenant, setTenant } from '../src/tenant/tenant.context.js';
import {
  RLS_MODELS,
  buildTenantGuc,
  makeTenantQueryHandler,
  type TenantRlsDeps,
} from '../src/tenant/prisma-tenant.extension.js';

type Guc = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;

function makeTx() {
  const calls: string[] = [];
  const executeRaw: Guc = (_strings, ...values) => {
    calls.push(`guc:${String(values[1])}`);
    return Promise.resolve(1);
  };
  const tx = {
    $executeRaw: executeRaw,
    role: {
      findMany: () => {
        calls.push('role.findMany');
        return Promise.resolve([{ id: 1 }]);
      },
    },
    item: {
      findMany: (args: unknown) => {
        calls.push(`item.findMany:${JSON.stringify(args)}`);
        return Promise.resolve([{ id: 1 }]);
      },
    },
    customerRepAssignment: {
      findMany: () => {
        calls.push('customerRepAssignment.findMany');
        return Promise.resolve([]);
      },
    },
  };
  return { tx, calls };
}

function makeHandler(over?: Partial<TenantRlsDeps>) {
  const { tx, calls } = makeTx();
  const runTransaction = vi.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx));
  const deps: TenantRlsDeps = { runTransaction: runTransaction as unknown as TenantRlsDeps['runTransaction'], ...over };
  return { handler: makeTenantQueryHandler(deps), calls, runTransaction };
}

describe('tenant context', () => {
  it('defaults to null and reflects run/set', () => {
    expect(currentCompanyId()).toBeNull();
    runWithTenant({ companyId: 7 }, () => {
      expect(currentCompanyId()).toBe(7);
    });
    expect(currentCompanyId()).toBeNull();
    setTenant({ companyId: 9 });
    expect(currentCompanyId()).toBe(9);
    setTenant({ companyId: null });
  });
});

describe('tenant RLS query handler', () => {
  it('wraps non-RLS models too (their includes may reach RLS relations)', async () => {
    const { handler, runTransaction } = makeHandler();
    const result = await runWithTenant({ companyId: 3 }, () =>
      handler({ model: 'Role', operation: 'findMany', args: {}, query: vi.fn() }),
    );
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('wraps RLS models in a transaction that sets the company GUC first', async () => {
    const { handler, calls, runTransaction } = makeHandler();
    const result = await runWithTenant({ companyId: 42 }, () =>
      handler({ model: 'Item', operation: 'findMany', args: { where: {} }, query: vi.fn() }),
    );
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 1 }]);
    expect(calls[0]).toBe('guc:42');
    expect(calls[1]).toBe('item.findMany:{"where":{}}');
  });

  it('maps PascalCase model names to camelCase delegates', async () => {
    const { handler, calls } = makeHandler();
    await runWithTenant({ companyId: 1 }, () =>
      handler({ model: 'CustomerRepAssignment', operation: 'findMany', args: {}, query: vi.fn() }),
    );
    expect(calls).toContain('customerRepAssignment.findMany');
  });

  it('closes by default (empty GUC) when no tenant is present', async () => {
    const { handler, calls } = makeHandler();
    await handler({ model: 'Item', operation: 'findMany', args: {}, query: vi.fn() });
    expect(calls[0]).toBe('guc:');
  });

  it('lists the RLS-protected models without auth/control-plane tables', () => {
    expect(RLS_MODELS.size).toBe(41);
    expect(RLS_MODELS.has('Item')).toBe(true);
    expect(RLS_MODELS.has('User')).toBe(false);
    expect(RLS_MODELS.has('CompanyFeature')).toBe(false);
  });
});

describe('buildTenantGuc', () => {
  it('emits an empty value for a null company', async () => {
    const executeRaw = vi.fn((_strings: TemplateStringsArray, ...values: unknown[]) =>
      Promise.resolve(values[0] as number),
    );
    await buildTenantGuc(executeRaw, null);
    expect(executeRaw.mock.calls[0]![2]).toBe('');
    await buildTenantGuc(executeRaw, 5);
    expect(executeRaw.mock.calls[1]![2]).toBe('5');
  });
});
