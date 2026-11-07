import { decimalInput, lineCents, centsDecimal } from "@/lib/ddt/money";
import { UserFacingError } from "@/lib/user-errors";
import type { Sale } from "@/types/sales";

export type SaleLineDraft = { quantity: string; unit_price: string; discount: string };

export function prepareCartLines(sale: Sale, drafts: Record<string, SaleLineDraft>) {
  if (Object.keys(drafts).some(id => !sale.lines.some(line => line.product_id === id))) {
    throw new UserFacingError("Il carrello è cambiato. Ricarica prima di salvare.");
  }
  return sale.lines.map(line => {
    const draft = drafts[line.product_id] ?? line;
    const quantity = decimalInput(draft.quantity, 3, "Quantità");
    const unit_price = decimalInput(draft.unit_price, 2, "Prezzo");
    const discount = decimalInput(draft.discount || "0", 2, "Sconto");
    return { ...line, quantity, unit_price, discount, line_total: centsDecimal(lineCents(quantity, unit_price, discount)) };
  });
}

/** Validate every draft before sending any updates; always use the returned version. */
export async function saveCartLines(
  sale: Sale,
  drafts: Record<string, SaleLineDraft>,
  update: (sale: Sale, index: number, quantity: string, price: string, discount: string) => Promise<Sale>,
  onSaved: (sale: Sale, productId: string) => void,
) {
  const lines = prepareCartLines(sale, drafts);
  let current = sale;
  for (const line of lines) {
    if (!drafts[line.product_id]) continue;
    const index = current.lines.findIndex(item => item.product_id === line.product_id);
    if (index < 0) throw new UserFacingError("Il carrello è cambiato. Ricarica prima di salvare.");
    current = await update(current, index, line.quantity, line.unit_price, line.discount);
    onSaved(current, line.product_id);
  }
  return current;
}
