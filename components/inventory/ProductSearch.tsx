"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScanBarcode, Search } from "lucide-react";
import { findProductsByCode } from "@/lib/inventory/api";
import type { Product } from "@/types/inventory";
import { EmptyProductState, ProductCard } from "./ProductCard";

export function ProductSearch() {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const search = async (event?: React.FormEvent) => {
    event?.preventDefault(); const code = value.trim(); if (!code) return;
    setLoading(true); setMessage("");
    try { setProducts(await findProductsByCode(code)); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Errore di ricerca."); }
    finally { setLoading(false); setTimeout(() => input.current?.focus(), 0); }
  };
  return <div className="space-y-6"><form onSubmit={search} className="rounded-xl border bg-card p-4 sm:p-5"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><ScanBarcode className="h-4 w-4 text-primary" />Scansiona o inserisci un codice</div><div className="flex gap-2"><Input ref={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Punta la pistola qui o digita un codice…" className="h-12 font-mono text-base" autoFocus disabled={loading} /><Button type="submit" className="h-12 px-5" disabled={loading || !value.trim()}><Search className="mr-2 h-4 w-4" />Cerca</Button></div><p className="mt-2 text-xs text-muted-foreground">Il lettore USB/Bluetooth invia il codice e Invio: la ricerca parte automaticamente.</p></form>
    {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}
    {products?.length === 0 && <EmptyProductState />}
    {products && products.length > 1 && <Alert><AlertDescription>Questo codice corrisponde a più prodotti. Seleziona quello corretto nella lista.</AlertDescription></Alert>}
    <div className="grid gap-4">{products?.map((product) => <ProductCard product={product} key={product.id} />)}</div>
  </div>;
}
