import type { Receipt } from './charge.ts';

export function refundable(receipt: Receipt): boolean {
  return receipt.captured && receipt.amount > 0;
}
