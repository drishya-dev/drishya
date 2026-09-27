import type { Cart } from './types.ts';
import { applyDiscount } from './discount.ts';

export function subtotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** The amount to charge. Zero for a fully discounted order; null when the cart is empty. */
export function computeTotal(cart: Cart): number | null {
  if (cart.items.length === 0) return null;
  return applyDiscount(subtotal(cart), cart);
}
