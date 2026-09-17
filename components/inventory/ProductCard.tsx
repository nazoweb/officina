"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, PackageSearch } from "lucide-react";
import type { Product } from "@/types/inventory";

const label: Record<string, string> = { barcode: "Barcode", internal_code: "Interno", mav: "MAV", cross_reference: "Cross ref", supplier_code: "Fornitore" };

export function ProductCard({ product, onAdd, onAdjustStock, compact = false }: { product: Product; onAdd?: () => void; onAdjustStock?: () => void; compact?: boolean }) {
  const isNegative = product.stock_quantity < 0;
  const belowMinimum = product.minimum_stock !== null && product.stock_quantity <= product.minimum_stock;
  return <article className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
    <div className="flex gap-3 justify-between"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{product.internal_code}</p><h2 className="mt-1 text-lg font-semibold leading-tight">{product.name || "Prodotto senza nome"}</h2>{product.brand && <p className="mt-1 text-sm text-muted-foreground">{product.brand}{product.category ? ` · ${product.category}` : ""}</p>}</div><div className={`shrink-0 rounded-lg px-3 py-2 text-right ${isNegative ? "bg-destructive/10 text-destructive" : belowMinimum ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}><p className="text-xs font-medium">Giacenza</p><p className="text-xl font-bold tabular-nums">{product.stock_quantity} <span className="text-xs">{product.unit}</span></p></div></div>
    {!compact && <div className="flex flex-wrap gap-1.5">{product.product_identifiers.map((identifier) => <Badge key={identifier.id || `${identifier.kind}-${identifier.value}`} variant="secondary" className="font-mono text-xs"><span className="mr-1 font-sans text-muted-foreground">{label[identifier.kind]}</span>{identifier.value}</Badge>)}</div>}
    {product.product_prices.length > 0 && <div className="flex flex-wrap gap-2">{product.product_prices.sort((a, b) => (a.price_list?.sort_order ?? 0) - (b.price_list?.sort_order ?? 0)).map((price) => <div key={price.id} className="rounded-md bg-muted px-2.5 py-1.5"><span className="mr-1 text-xs text-muted-foreground">{price.price_list?.name ?? "Prezzo"}</span><span className="font-semibold tabular-nums">{Number(price.amount).toFixed(2)} €</span></div>)}</div>}
    {(onAdd || onAdjustStock) && <div className="flex flex-wrap gap-2">{onAdd && <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Aggiungi alla lista aperta</Button>}{onAdjustStock && <Button variant="outline" onClick={onAdjustStock}>Rettifica giacenza</Button>}</div>}
  </article>;
}

export function EmptyProductState({ message = "Nessun prodotto trovato." }: { message?: string }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground"><PackageSearch className="mx-auto mb-3 h-8 w-8" /><p className="font-medium text-foreground">{message}</p><p className="mt-1 text-sm">Prova un barcode, un codice interno, MAV o cross-reference.</p></div>;
}
