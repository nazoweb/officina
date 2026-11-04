"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, PackageSearch } from "lucide-react";
import type { Product } from "@/types/inventory";
import { useId, useState } from "react";
import { ProductActions } from "./ProductActions";
import { ProductDetails } from "./ProductDetails";

const label: Record<string, string> = { barcode: "Barcode", internal_code: "Interno", mav: "MAV", cross_reference: "Cross ref", supplier_code: "Codice fornitore" };

export function ProductCard({ product, onAdd, onAdjustStock, onDeleted }: { product: Product; onAdd?: () => void; onAdjustStock?: () => void; onDeleted?: () => void | Promise<void>; compact?: boolean }) {
  const [deleted, setDeleted] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const pricesId = useId();
  const prices = [...product.product_prices].sort((a, b) => (a.price_list?.sort_order ?? 0) - (b.price_list?.sort_order ?? 0));
  const salePrice = prices.find((price) => price.price_list?.name.trim().toLocaleLowerCase("it-IT") === "prezzo vendita");
  const reservedPrices = prices.filter((price) => price !== salePrice);
  const currency = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  if (deleted) return null;
  const isNegative = product.stock_quantity < 0;
  const belowMinimum = product.minimum_stock !== null && product.stock_quantity <= product.minimum_stock;
  return <article className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
    <div className="flex gap-3 justify-between"><div className="min-w-0"><p className="font-mono text-xs text-muted-foreground">{product.internal_code}</p><h2 className="mt-1 text-lg font-semibold leading-tight">{product.name || "Prodotto senza nome"}</h2>{product.brand && <p className="mt-1 text-sm text-muted-foreground">{product.brand}{product.category ? ` · ${product.category}` : ""}</p>}</div><div className={`shrink-0 rounded-lg px-3 py-2 text-right ${isNegative ? "bg-destructive/10 text-destructive" : belowMinimum ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}><p className="text-xs font-medium">Giacenza</p><p className="text-xl font-bold tabular-nums">{product.stock_quantity} <span className="text-xs">{product.unit}</span></p></div></div>
    <div className="flex flex-wrap gap-1.5">{product.product_identifiers.filter((identifier) => identifier.kind === "supplier_code").map((identifier) => <Badge key={identifier.id || `${identifier.kind}-${identifier.value}`} variant="secondary" className="font-mono text-xs"><span className="mr-1 font-sans text-muted-foreground">{label[identifier.kind]}</span>{identifier.value}</Badge>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-muted-foreground">Prezzo di vendita</p><p className="mt-0.5 text-2xl font-semibold tabular-nums">{salePrice ? currency.format(Number(salePrice.amount)) : <span className="text-base text-muted-foreground">Non impostato</span>}</p></div>
      {reservedPrices.length > 0 && <Button variant="ghost" className="h-auto min-h-9 whitespace-normal text-left" aria-expanded={showPrices} aria-controls={pricesId} onClick={() => setShowPrices(!showPrices)}>{showPrices ? "Nascondi prezzi riservati" : "Mostra prezzi riservati"}<ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showPrices ? "rotate-180" : ""}`} /></Button>}
    </div>
    {reservedPrices.length > 0 && <div id={pricesId} hidden={!showPrices}><div className="flex flex-wrap gap-2">{reservedPrices.map((price) => <div key={price.id} className="rounded-md bg-muted px-3 py-2"><p className="text-xs text-muted-foreground">{({ "Sconto aziende": "Prezzo aziende", "Sconto officine": "Prezzo officine" } as Record<string, string>)[price.price_list?.name ?? ""] ?? price.price_list?.name ?? "Prezzo riservato"}</p><p className="font-semibold tabular-nums">{currency.format(Number(price.amount))}</p></div>)}</div></div>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><ProductDetails product={product} /><div className="flex flex-wrap gap-2">{onAdd && <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Aggiungi alla lista aperta</Button>}<ProductActions product={product} onAdjustStock={onAdjustStock} onDeleted={async () => { setDeleted(true); await onDeleted?.(); }} /></div></div>
  </article>;
}

export function EmptyProductState({ message = "Nessun prodotto trovato." }: { message?: string }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground"><PackageSearch className="mx-auto mb-3 h-8 w-8" /><p className="font-medium text-foreground">{message}</p><p className="mt-1 text-sm">Prova un barcode, un codice interno, MAV o cross-reference.</p></div>;
}
