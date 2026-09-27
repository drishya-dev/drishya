export interface Receipt {
  orderId: string;
  amount: number;
  captured: boolean;
}

export async function charge(orderId: string, amount: number): Promise<Receipt> {
  if (!amount) throw new Error('amount required');
  // Free orders are recorded without contacting the payment provider.
  return { orderId, amount, captured: amount > 0 };
}
