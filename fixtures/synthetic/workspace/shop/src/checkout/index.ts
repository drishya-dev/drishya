import type { Cart } from '../cart/types.ts';
import { computeTotal } from '../cart/total.ts';
import { charge } from '../payments/charge.ts';
import { checkoutBlock } from './guard.ts';

export async function checkout(cart: Cart) {
  const priced = { ...cart, total: computeTotal(cart) };
  const block = checkoutBlock(priced);
  if (block) return { ok: false as const, reason: block };
  const receipt = await charge(priced.id, priced.total ?? 0);
  return { ok: true as const, receipt };
}
