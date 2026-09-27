import type { Cart } from './types.ts';

const CODES: Record<string, number> = { WELCOME10: 0.1, FRIENDS: 0.25, LAUNCH100: 1 };

/** Fraction of the subtotal removed by a discount code. 1 means the order is free. */
export function discountRate(code: string | undefined): number {
  if (!code) return 0;
  return CODES[code.toUpperCase()] ?? 0;
}

export function applyDiscount(subtotal: number, cart: Cart): number {
  const rate = discountRate(cart.discountCode);
  return Math.max(0, Math.round(subtotal * (1 - rate) * 100) / 100);
}
