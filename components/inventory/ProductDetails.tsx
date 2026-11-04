"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Product } from "@/types/inventory";

const labels: Record<string, string> = { barcode: "Barcode", internal_code: "Codice interno", mav: "MAV", cross_reference: "Cross reference", supplier_code: "Codice fornitore" };
const currency = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function ProductDetails({ product }: { product: Product }) {
  const fields = [["Marca", product.brand], ["Categoria", product.category], ["Fornitore", product.supplier], ["Ubicazione", product.location], ["Descrizione", product.description], ["Note", product.notes]].filter(([, value]) => value);
  return <Sheet>
    <SheetTrigger asChild><Button variant="outline"><Info className="h-4 w-4" />Dettagli prodotto</Button></SheetTrigger>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader className="pr-12">
        <SheetTitle>{product.name || "Prodotto senza nome"}</SheetTitle>
        <SheetDescription>Dettagli prodotto · {product.internal_code}</SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <section className="space-y-3"><h3 className="text-sm font-semibold">Informazioni prodotto</h3><dl className="space-y-3 text-sm">
          <div><dt className="text-muted-foreground">Codice interno</dt><dd className="break-words font-mono">{product.internal_code}</dd></div>
          {fields.map(([name, value]) => <div key={name}><dt className="text-muted-foreground">{name}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
          <div><dt className="text-muted-foreground">Giacenza</dt><dd>{product.stock_quantity} {product.unit}</dd></div>
          {product.minimum_stock != null && <div><dt className="text-muted-foreground">Scorta minima</dt><dd>{product.minimum_stock} {product.unit}</dd></div>}
        </dl></section>
        <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">Codici e cross reference</h3>
          {product.product_identifiers.length ? <dl className="space-y-3 text-sm">{product.product_identifiers.map((identifier) => <div key={identifier.id || `${identifier.kind}-${identifier.value}`}><dt className="text-muted-foreground">{labels[identifier.kind] || identifier.kind}</dt><dd className="break-words font-mono">{identifier.value}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Nessun codice aggiuntivo.</p>}
        </section>
        <section className="space-y-3 rounded-lg border bg-muted/40 p-4 print:hidden"><h3 className="text-sm font-semibold">Dati interni</h3><dl className="text-sm"><dt className="text-muted-foreground">Prezzo d’acquisto (uso interno)</dt><dd className="mt-1 font-semibold tabular-nums">{product.purchase_price != null ? currency.format(Number(product.purchase_price)) : "Non impostato"}</dd></dl></section>
      </div>
    </SheetContent>
  </Sheet>;
}
