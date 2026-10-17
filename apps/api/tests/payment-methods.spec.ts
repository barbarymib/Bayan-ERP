import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePaymentDto, CreateReceiptDto, PAYMENT_METHODS } from '../src/collections/collections.dto.js';

describe('PAYMENT_METHODS (§5.10 فودافون كاش/إنستاباي)', () => {
  it('يشمل الطرق المسمّاة في المواصفة', () => {
    expect(PAYMENT_METHODS).toContain('CASH');
    expect(PAYMENT_METHODS).toContain('TRANSFER');
    expect(PAYMENT_METHODS).toContain('CHEQUE');
    expect(PAYMENT_METHODS).toContain('VODAFONE_CASH');
    expect(PAYMENT_METHODS).toContain('INSTAPAY');
    expect(PAYMENT_METHODS).toContain('WALLET');
  });

  it('يقبل طريقة VODAFONE_CASH في سند القبض', async () => {
    const dto = plainToInstance(CreateReceiptDto, { customerId: 1, amount: 100, method: 'VODAFONE_CASH' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('يقبل طريقة INSTAPAY في سند الصرف', async () => {
    const dto = plainToInstance(CreatePaymentDto, { supplierId: 1, amount: 100, method: 'INSTAPAY' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('يرفض طريقة غير معروفة', async () => {
    const dto = plainToInstance(CreateReceiptDto, { customerId: 1, amount: 100, method: 'CRYPTO' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.property).toBe('method');
  });
});
