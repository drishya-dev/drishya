import { describe, expect, it } from 'vitest';
import { canCheckout, checkoutBlock } from '../src/checkout/guard.ts';

const item = { sku: 'tee', price: 20, quantity: 1 };

describe('canCheckout', () => {
  it('blocks an empty cart', () => {
    expect(checkoutBlock({ id: 'c1', items: [] })).toBe('empty-cart');
  });

  it('allows a priced cart', () => {
    expect(canCheckout({ id: 'c2', items: [item], total: 20 })).toBe(true);
  });

  it('allows a free order', () => {
    expect(canCheckout({ id: 'c3', items: [item], total: 0, discountCode: 'LAUNCH100' })).toBe(true);
  });

  it('still blocks a cart whose total is missing', () => {
    expect(checkoutBlock({ id: 'c4', items: [item], total: null })).toBe('missing-total');
  });
});
