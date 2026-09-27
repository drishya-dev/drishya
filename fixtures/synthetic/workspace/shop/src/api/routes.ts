import type { Cart } from '../cart/types.ts';
import { checkout } from '../checkout/index.ts';

export async function postCheckout(body: { cart: Cart }) {
  const result = await checkout(body.cart);
  return result.ok ? { status: 200, body: result.receipt } : { status: 422, body: { error: result.reason } };
}
