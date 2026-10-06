import type { ProductDraft } from "@/types/inventory";
import { parseCrossReferences } from "../codici/normalizeCode";

export const importLabels = {
  internal_code: "Nostro codice / codice interno", supplier_code: "Codice fornitore",
  name: "Nome / descrizione", barcode: "Codice a barre", cross: "Cross-reference",
  sale_price: "Prezzo vendita", company_price: "Sconto aziende (prezzo in €)", workshop_price: "Sconto officine (prezzo in €)",
  stock: "Quantità / giacenza iniziale", mav: "Codice MAV", minimum_stock: "Scorta minima",
  brand: "Marca", category: "Categoria", location: "Ubicazione", supplier: "Fornitore (facoltativo)",
} as const;
export type ImportField = keyof typeof importLabels;
export type ImportMapping = Partial<Record<ImportField, string>>;
const normalizedHeader = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const aliases: Record<ImportField, string[]> = {
  internal_code: ["NOSTRO CODICE", "CODICE INTERNO", "CODICE PRODOTTO", "ARTICOLO", "CODICE"], supplier_code: ["CODICE FORNITORE"],
  name: ["DESCRIZIONE", "NOME", "NOME PRODOTTO", "PRODOTTO"], barcode: ["CODICE A BARRE", "BARCODE", "EAN"], cross: ["CROSS REFERENCE", "CROSS REFERENCES", "CROSS"],
  sale_price: ["PREZZO VENDITA", "PREZZO DI VENDITA"], company_price: ["SCONTO AZIENDE", "PREZZO AZIENDE", "LISTINO AZIENDE"], workshop_price: ["SCONTO OFFICINE", "PREZZO OFFICINE", "LISTINO OFFICINE"],
  stock: ["QUANTITA", "GIACENZA", "GIACENZA INIZIALE"], mav: ["CODICE MAV", "MAV"], minimum_stock: ["SCORTA MINIMA", "MINIMO"],
  brand: ["MARCA", "BRAND"], category: ["CATEGORIA"], location: ["UBICAZIONE", "SCAFFALE"], supplier: ["FORNITORE"],
};
export function guessImportMapping(headers: string[]): ImportMapping {
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field,
    names.map((name) => headers.find((header) => normalizedHeader(header) === name)).find(Boolean) ?? "",
  ]));
}

// Formatted Excel cells may contain euro signs and Italian thousands separators.
export function parseImportNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || String(raw).trim() === "") return undefined;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new Error("Numero non valido.");
    return raw;
  }
  let value = String(raw).trim().replace(/EUR/gi, "").replace(/[€\s]/g, "");
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  if (!/^[+-]?\d+(\.\d+)?$/.test(value)) throw new Error(`Valore numerico non valido: ${String(raw)}.`);
  return Number(value);
}

export function importedDraft(row: Record<string, unknown>, mapping: ImportMapping, headers: string[]): ProductDraft | null {
  const text = (field: ImportField) => mapping[field] ? String(row[mapping[field]!] ?? "").trim() : undefined;
  const code = text("internal_code");
  if (!code) return null;
  const draft: ProductDraft = { internal_code: code };
  const textFields = { name: "name", supplier_code: "supplierCode", barcode: "barcode", mav: "mav", brand: "brand", category: "category", location: "location", supplier: "supplier" } as const;
  for (const [field, property] of Object.entries(textFields)) {
    const value = text(field as ImportField);
    if (value !== undefined) draft[property as typeof textFields[keyof typeof textFields]] = value;
  }
  if (mapping.cross) draft.crossReferences = parseCrossReferences(text("cross"));
  for (const [field, property] of [["stock", "stockQuantity"], ["minimum_stock", "minimumStock"]] as const) {
    if (!mapping[field]) continue;
    const amount = parseImportNumber(row[mapping[field]!]);
    if (amount !== undefined && !Number.isInteger(amount)) throw new Error(`${importLabels[field]}: inserisci un numero intero.`);
    if (amount !== undefined) draft[property] = amount;
  }
  const prices: NonNullable<ProductDraft["prices"]> = [];
  const mappedPriceColumns = new Set<string>();
  for (const [field, name] of [["sale_price", "Prezzo vendita"], ["company_price", "Sconto aziende"], ["workshop_price", "Sconto officine"]] as const) {
    const header = mapping[field];
    if (!header) continue;
    mappedPriceColumns.add(header);
    const amount = parseImportNumber(row[header]);
    if (amount !== undefined) {
      if (amount < 0) throw new Error(`${name}: il prezzo non può essere negativo.`);
      prices.push({ name, amount });
    }
  }
  for (const header of headers.filter((h) => /prezzo|listino|price/i.test(h) && !mappedPriceColumns.has(h))) {
    const amount = parseImportNumber(row[header]);
    if (amount !== undefined) {
      if (amount < 0) throw new Error(`${header}: il prezzo non può essere negativo.`);
      prices.push({ name: header, amount });
    }
  }
  draft.prices = prices;
  return draft;
}
