"use client";

import { userErrorMessage } from "@/lib/user-errors";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adjustStock, listCategories, listProducts, assignProductsCategory } from "@/lib/inventory/api";
import { matchesProductQuery } from "@/lib/inventory/search";
import type { Product } from "@/types/inventory";
import { EmptyProductState, ProductCard } from "./ProductCard";
import { CategoriesManager } from "./CategoriesManager";

export function Warehouse() {
  const pending = useRef(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<"all" | "low" | "negative">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetCategory, setTargetCategory] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [stockError, setStockError] = useState("");
  const [stockBusy, setStockBusy] = useState(false);
  const reload = async () => {
    const [nextProducts, nextCategories] = await Promise.all([listProducts(), listCategories()]);
    setProducts(nextProducts); setCategories(nextCategories);
    setSelected([]); setError("");
    setCategory((current) => current === "all" || current === "none" || nextCategories.includes(current.slice(9)) ? current : "all");
  };
  useEffect(() => { reload().catch((cause) => setError(userErrorMessage(cause))).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return products.filter((product) => {
      const matchesText = matchesProductQuery(product, q);
      const matchesStock = filter === "all" || (filter === "negative" ? product.stock_quantity < 0 : product.minimum_stock !== null && product.stock_quantity <= product.minimum_stock);
      const matchesCategory = category === "all" || (category === "none" ? !product.category : product.category === category.slice(9));
      return matchesText && matchesStock && matchesCategory;
    });
  }, [products, query, filter, category]);
  const allSelected = visible.length > 0 && visible.every((product) => selected.includes(product.id));
  const assign = async () => {
    if (pending.current) return; pending.current = true;
    setAssigning(true); setError("");
    try { await assignProductsCategory(selected, targetCategory); await reload(); }
    catch (cause) { setError(userErrorMessage(cause, "Impossibile assegnare la categoria.")); }
    finally { pending.current = false; setAssigning(false); }
  };
  const rectify = async (event: React.FormEvent) => {
    event.preventDefault(); if (!stockProduct || pending.current) return;
    const amount = Number(delta.replace(",", "."));
    if (!Number.isSafeInteger(amount) || amount === 0 || amount < -2147483648 || amount > 2147483647) { setStockError("Inserisci una variazione intera diversa da zero."); return; }
    pending.current = true;
    setStockBusy(true); setStockError("");
    try { await adjustStock(stockProduct.id, amount, note); setStockProduct(null); await reload(); }
    catch (cause) { setStockError(userErrorMessage(cause, "Impossibile rettificare la giacenza.")); }
    finally { pending.current = false; setStockBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setSelected([]); }} className="pl-9" placeholder="Cerca nome, codice o categoria…" /></div><CategoriesManager categories={categories} products={products} onChanged={reload} /><Button asChild><Link href="/codici/nuovo"><Plus className="mr-2 h-4 w-4" />Nuovo prodotto</Link></Button></div>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => { setFilter("all"); setSelected([]); }}>Tutti ({products.length})</Button><Button size="sm" variant={filter === "low" ? "default" : "outline"} onClick={() => { setFilter("low"); setSelected([]); }}>Sottoscorta</Button><Button size="sm" variant={filter === "negative" ? "default" : "outline"} onClick={() => { setFilter("negative"); setSelected([]); }}>Negativi</Button><label className="flex items-center gap-2 text-sm">Categoria<select value={category} onChange={(event) => { setCategory(event.target.value); setSelected([]); }} className="h-9 max-w-60 rounded-md border bg-background px-3"><option value="all">Tutte le categorie</option><option value="none">Senza categoria</option>{categories.map((name) => <option key={name} value={`category:${name}`}>{name}</option>)}</select></label></div>
    {visible.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelected} disabled={assigning || stockBusy} onChange={(event) => setSelected(event.target.checked ? visible.map((product) => product.id) : [])} />Seleziona tutti i {visible.length} prodotti visualizzati</label>
      {selected.length > 0 && <><span className="text-sm">{selected.length} selezionati</span><label className="text-sm">Assegna categoria<Input className="mt-1" value={targetCategory} onChange={(event) => setTargetCategory(event.target.value)} list="bulk-categories" placeholder="Nome categoria" disabled={assigning || stockBusy} /></label><datalist id="bulk-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist><Button disabled={assigning || stockBusy} onClick={assign}>{assigning ? "Salvataggio…" : targetCategory.trim() ? "Assegna categoria" : "Rimuovi categoria"}</Button></>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && <p className="text-sm text-muted-foreground">Caricamento magazzino…</p>}
    <div className="grid gap-3">{visible.map((product) => <div key={product.id} className="flex items-start gap-3"><label className="mt-6 shrink-0"><span className="sr-only">Seleziona {product.internal_code}</span><input type="checkbox" checked={selected.includes(product.id)} disabled={assigning || stockBusy} onChange={(event) => setSelected(event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} /></label><div className="min-w-0 flex-1"><ProductCard product={product} compact onDeleted={reload} onAdjustStock={() => { setStockProduct(product); setDelta(""); setNote(""); setStockError(""); }} /></div></div>)}</div>
    {!loading && !error && visible.length === 0 && <EmptyProductState message={products.length ? "Nessun prodotto corrisponde ai filtri." : "Il magazzino è vuoto."} />}
    <Dialog open={stockProduct !== null} onOpenChange={(next) => { if (!next && !stockBusy) setStockProduct(null); }}><DialogContent showCloseButton={!stockBusy}><DialogHeader><DialogTitle>Rettifica giacenza</DialogTitle><DialogDescription>{stockProduct?.internal_code}: {stockProduct?.stock_quantity} {stockProduct?.unit} disponibili. Inserisci una variazione, per esempio +3 o -2.</DialogDescription></DialogHeader><form onSubmit={rectify} className="space-y-4"><label className="block text-sm font-medium">Variazione<Input className="mt-1.5" value={delta} onChange={(event) => setDelta(event.target.value)} type="number" step="1" required disabled={stockBusy} /></label><label className="block text-sm font-medium">Motivo (facoltativo)<Input className="mt-1.5" value={note} onChange={(event) => setNote(event.target.value)} disabled={stockBusy} /></label>{stockError && <p role="alert" className="text-sm text-destructive">{stockError}</p>}<Button disabled={stockBusy}>{stockBusy ? "Salvataggio…" : "Salva rettifica"}</Button></form></DialogContent></Dialog>
  </div>;
}
