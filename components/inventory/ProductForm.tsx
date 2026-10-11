"use client";

import { userErrorMessage, UserFacingError } from "@/lib/user-errors";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getProduct, listCategories, saveProduct } from "@/lib/inventory/api";
import { parseImportNumber } from "@/lib/inventory/import";
import { parseCrossReferences } from "@/lib/codici/normalizeCode";
import type { Product, ProductDraft } from "@/types/inventory";

export function ProductEditor({ productId }: { productId: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getProduct(productId).then(setProduct).catch((cause) => setError(userErrorMessage(cause))); }, [productId]);
  if (error) return <p role="alert" className="text-destructive">{error}</p>;
  if (!product) return <p>Caricamento prodotto…</p>;
  return <ProductForm product={product} />;
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [kind, setKind] = useState<"goods" | "service">(product?.kind ?? "goods");
  const [code, setCode] = useState(product?.internal_code ?? "");
  const [prices, setPrices] = useState(() => product?.product_prices.length
    ? product.product_prices.map((price) => ({ name: price.price_list?.name ?? "Prezzo", amount: String(price.amount) }))
    : ["Prezzo vendita", "Sconto aziende", "Sconto officine"].map((name) => ({ name, amount: "" })));
  useEffect(() => { listCategories().then(setCategories).catch((cause) => setError(userErrorMessage(cause))); }, []);
  const identifier = (kind: string) => product?.product_identifiers.filter((item) => item.kind === kind).map((item) => item.value).join("; ") ?? "";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try {
      const parsedPrices = prices.flatMap((price) => {
        if (!price.amount.trim()) return [];
        const amount = parseImportNumber(price.amount);
        if (!price.name.trim() || amount === undefined || amount < 0) throw new UserFacingError("Inserisci nome e importo valido per ogni prezzo.");
        return [{ name: price.name.trim(), amount }];
      });
      if (new Set(parsedPrices.map((price) => price.name.toLocaleLowerCase("it"))).size !== parsedPrices.length) throw new UserFacingError("Usa nomi diversi per i listini.");
      const text = (key: string) => String(data.get(key) ?? "").trim();
      const draft: ProductDraft = {
        internal_code: code, kind, name: text("name"), supplierCode: text("supplier_code"), mav: text("mav"),
        crossReferences: parseCrossReferences(text("cross_references")), brand: text("brand"), category: text("category"),
        description: text("description"), location: text("location"), supplier: text("supplier"), unit: text("unit") || "pz",
        stockQuantity: Number(text("stock_quantity") || 0), minimumStock: text("minimum_stock") ? Number(text("minimum_stock")) : null,
        notes: text("notes"), prices: parsedPrices,
      };
      if (!Number.isInteger(draft.stockQuantity) || (draft.minimumStock !== null && (!Number.isInteger(draft.minimumStock) || draft.minimumStock! < 0))) throw new UserFacingError("Giacenza e scorta minima devono essere numeri interi.");
      await saveProduct(draft, product);
      router.push("/codici/magazzino"); router.refresh();
    } catch (cause) { setError(userErrorMessage(cause, "Impossibile salvare il prodotto.")); }
    finally { submitting.current = false; setSaving(false); }
  };

  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={saving} className="space-y-5">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Dati prodotto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="internal_code" label="Nostro codice" maxLength={100} required autoFocus value={code} onChange={(event) => setCode(event.target.value)} />
          <label className="block text-sm font-medium">Tipologia<select aria-label="Tipologia prodotto" className="mt-1.5 h-9 w-full rounded-md border bg-background px-3" value={kind} onChange={event => setKind(event.target.value as "goods" | "service")}><option value="goods">Ricambio / merce</option><option value="service">Prestazione / manodopera</option></select></label>
          <Field name="name" label="Nome prodotto" defaultValue={product?.name} />
          <Field label="Barcode automatico" value={code.trim().toUpperCase()} readOnly hint="Coincide con il nostro codice, anche quando lo modifichi." />
          <Field name="supplier_code" label="Codice fornitore" defaultValue={identifier("supplier_code")} />
          <Field name="mav" label="Codice MAV" defaultValue={identifier("mav")} />
          <Field name="cross_references" label="Cross-reference" defaultValue={identifier("cross_reference")} hint="Separali con virgola o punto e virgola." />
          <Field name="category" label="Categoria" defaultValue={product?.category} list="product-categories" hint="Scegli una categoria o scrivi un nuovo nome." />
          <datalist id="product-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          <Field name="brand" label="Marca" defaultValue={product?.brand} />
          <Field name="supplier" label="Fornitore" defaultValue={product?.supplier} />
          <Field name="location" label="Ubicazione" defaultValue={product?.location} />
          <Field key={kind} name="unit" label="Unità di misura" defaultValue={product?.unit ?? (kind === "service" ? "ore" : "pz")} />
          <Field name="stock_quantity" label={product ? "Giacenza attuale" : "Giacenza iniziale"} type="number" step="1" defaultValue={product?.stock_quantity ?? 0} hint={product ? "La variazione viene registrata come rettifica di magazzino." : undefined} />
          <Field name="minimum_stock" label="Scorta minima" type="number" min="0" step="1" defaultValue={product?.minimum_stock ?? ""} />
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Prezzi e listini</h2>
        <p className="mt-1 text-sm text-muted-foreground">Importi finali in euro. Lascia vuoto o rimuovi un prezzo per eliminarlo dal prodotto.</p>
        <div className="mt-4 space-y-3">{prices.map((price, index) => <div key={index} className="flex items-end gap-2">
          <Field label="Listino" value={price.name} onChange={(event) => setPrices(prices.map((value, i) => i === index ? { ...value, name: event.target.value } : value))} />
          <Field label="Prezzo (€)" inputMode="decimal" value={price.amount} onChange={(event) => setPrices(prices.map((value, i) => i === index ? { ...value, amount: event.target.value } : value))} />
          <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={`Rimuovi ${price.name || "prezzo"}`} onClick={() => setPrices(prices.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>)}</div>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setPrices([...prices, { name: "", amount: "" }])}><Plus className="mr-2 h-4 w-4" />Aggiungi prezzo</Button>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <label className="block text-sm font-medium">Descrizione<Textarea name="description" defaultValue={product?.description} className="mt-1.5" /></label>
        <label className="block text-sm font-medium">Note<Textarea name="notes" defaultValue={product?.notes} className="mt-1.5" /></label>
      </section>
    </fieldset>
    {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    <div className="flex gap-3"><Button disabled={saving}>{saving ? "Salvataggio…" : "Salva prodotto"}</Button><Button variant="outline" asChild disabled={saving}><Link href="/codici/magazzino">Annulla</Link></Button></div>
  </form>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block min-w-0 flex-1 text-sm font-medium">{label}<Input className="mt-1.5" {...props} />{hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}
