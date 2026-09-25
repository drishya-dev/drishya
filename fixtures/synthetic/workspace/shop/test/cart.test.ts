import { describe, expect, it } from 'vitest';
import { computeTotal } from '../src/cart/total.ts';

describe('computeTotal', () => {
  it('sums line items', () => {
    expect(computeTotal({ id: 'a', items: [{ sku: 'x', price: 5, quantity: 2 }] })).toBe(10);
  });

  it('is zero for a fully discounted order', () => {
    expect(computeTotal({ id: 'b', items: [{ sku: 'x', price: 5, quantity: 1 }], discountCode: 'LAUNCH100' })).toBe(0);
  });

  it('is null for an empty cart', () => {
    expect(computeTotal({ id: 'c', items: [] })).toBeNull();
  });
});
