export type IdentifierKind = "barcode" | "internal_code" | "mav" | "cross_reference" | "supplier_code";

export interface ProductIdentifier {
  id: string;
  product_id: string;
  kind: IdentifierKind;
  value: string;
  normalized_value: string;
}

export interface ProductPrice {
  id: string;
  amount: number;
  currency: string;
  price_list?: { id: string; name: string; sort_order: number } | null;
}

export interface Product {
  id: string;
  internal_code: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  location: string;
  unit: string;
  stock_quantity: number;
  minimum_stock: number | null;
  supplier: string;
  notes: string;
  active: boolean;
  product_identifiers: ProductIdentifier[];
  product_prices: ProductPrice[];
}

export interface OrderSummary {
  id: string;
  order_number: number;
  name: string;
  notes: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  order_items?: { quantity: number }[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  product_name_snapshot: string;
  internal_code_snapshot: string;
  unit_snapshot: string;
  product?: Product | null;
}

export interface OrderDetail extends OrderSummary {
  order_items: OrderItem[];
}

export interface ProductDraft {
  internal_code: string;
  name: string;
  barcode?: string;
  mav?: string;
  crossReferences?: string[];
  description?: string;
  brand?: string;
  category?: string;
  location?: string;
  unit?: string;
  stockQuantity?: number;
  minimumStock?: number | null;
  supplier?: string;
  notes?: string;
  prices?: Array<{ name: string; amount: number }>;
}
