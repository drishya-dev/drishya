export interface LineItem {
  sku: string;
  price: number;
  quantity: number;
}

export interface Cart {
  id: string;
  items: LineItem[];
  total?: number | null;
  discountCode?: string;
}
