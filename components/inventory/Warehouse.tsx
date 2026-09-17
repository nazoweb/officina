"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adjustStock, listProducts } from "@/lib/inventory/api";
import type { Product } from "@/types/inventory";
import { EmptyProductState, ProductCard } from "./ProductCard";
import { Plus, Search } from "lucide-react";

export function Warehouse() {
  const [products, setProducts] = useState<Product[]>([]); const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "low" | "negative">("all"); const [error, setError] = useState("");
  const reload = () => listProducts().then(setProducts).catch((cause) => setError(cause.message));
  useEffect(() => { reload(); }, []);
  const visible = useMemo(() => { const q = query.trim().toUpperCase(); return products.filter((product) => { const matchesText = !q || [product.internal_code, product.name, product.brand, ...product.product_identifiers.map((i) => i.value)].join(" ").toUpperCase().includes(q); const matchesStock = filter === "all" || (filter === "negative" ? product.stock_quantity < 0 : product.minimum_stock !== null && product.stock_quantity <= product.minimum_stock); return matchesText && matchesStock; }); }, [products, query, filter]);
  const rectify = async (product: Product) => { const raw = window.prompt(`Rettifica giacenza per ${product.name || product.internal_code}. Inserisci + o - pezzi:`, ""); if (raw === null) return; const delta = Number(raw.replace(",", ".")); if (!Number.isInteger(delta) || delta === 0) { setError("Inserisci una variazione intera diversa da zero."); return; } const note = window.prompt("Motivo della rettifica (facoltativo):", "") ?? ""; try { await adjustStock(product.id, delta, note); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossibile rettificare la giacenza."); } };
  return <div className="space-y-5"><div className="flex flex-wrap items-center gap-3"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Cerca nome o codice…" /></div><Button asChild><Link href="/codici/nuovo"><Plus className="mr-2 h-4 w-4" />Nuovo prodotto</Link></Button></div><div className="flex gap-2"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Tutti ({products.length})</Button><Button size="sm" variant={filter === "low" ? "default" : "outline"} onClick={() => setFilter("low")}>Sottoscorta</Button><Button size="sm" variant={filter === "negative" ? "default" : "outline"} onClick={() => setFilter("negative")}>Negativi</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="grid gap-3">{visible.map((product) => <ProductCard product={product} key={product.id} compact onAdjustStock={() => rectify(product)} />)}{!error && visible.length === 0 && <EmptyProductState message={products.length ? "Nessun prodotto corrisponde ai filtri." : "Il magazzino è vuoto."} />}</div></div>;
}
