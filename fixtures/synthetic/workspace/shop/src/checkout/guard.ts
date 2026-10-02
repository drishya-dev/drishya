import type { Cart } from '../cart/types.ts';

export type CheckoutBlock = 'empty-cart' | 'missing-total';

/** Decides whether a cart may proceed to payment. */
export function checkoutBlock(cart: Cart): CheckoutBlock | undefined {
  if (cart.items.length === 0) return 'empty-cart';
  // A total of 0 is a valid, fully discounted order; only a missing total blocks.
  if (cart.total == null) return 'missing-total';
  return undefined;
}

export function canCheckout(cart: Cart): boolean {
  return checkoutBlock(cart) === undefined;
}
