import { normalizeCode } from "../codici/normalizeCode";
import type { Product } from "../../types/inventory";

// Use the same catalogue fields for keyboard searches in both product search and warehouse.
export function matchesProductQuery(product: Product, query: string): boolean {
  const normalized = normalizeCode(query);
  return !normalized || [
    product.internal_code, product.name, product.brand, product.category,
    ...product.product_identifiers.map((identifier) => identifier.value),
  ].join(" ").toUpperCase().includes(normalized);
}
