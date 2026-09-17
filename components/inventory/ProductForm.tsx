"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "@/lib/inventory/api";

export function ProductForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); const data = new FormData(event.currentTarget);
    try {
      await createProduct({ internal_code: String(data.get("internal_code")), name: String(data.get("name")), barcode: String(data.get("barcode") || ""), mav: String(data.get("mav") || ""), crossReferences: String(data.get("cross_references") || "").split(/[;,\n]/).map((v) => v.trim()).filter(Boolean), brand: String(data.get("brand") || ""), category: String(data.get("category") || ""), location: String(data.get("location") || ""), supplier: String(data.get("supplier") || ""), unit: String(data.get("unit") || "pz"), stockQuantity: Number(data.get("stock_quantity") || 0), minimumStock: data.get("minimum_stock") ? Number(data.get("minimum_stock")) : null, notes: String(data.get("notes") || "") });
      router.push("/codici/magazzino"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossibile salvare il prodotto."); }
    finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="max-w-3xl space-y-5"><section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"><Field name="internal_code" label="Codice prodotto interno" required autoFocus /><Field name="name" label="Nome prodotto" required /><Field name="barcode" label="Barcode" /><Field name="mav" label="Codice MAV" /><Field name="cross_references" label="Cross-reference" hint="Separali con virgola o punto e virgola" /><Field name="brand" label="Marca" /><Field name="category" label="Categoria" /><Field name="supplier" label="Fornitore" /><Field name="location" label="Ubicazione" /><Field name="unit" label="Unità di misura" defaultValue="pz" /><Field name="stock_quantity" label="Giacenza iniziale" type="number" defaultValue="0" /><Field name="minimum_stock" label="Scorta minima" type="number" /></section><section className="rounded-xl border bg-card p-5"><label className="mb-2 block text-sm font-medium">Note</label><Textarea name="notes" placeholder="Informazioni utili per l’officina…" /></section>{error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<Button disabled={saving}>{saving ? "Salvataggio…" : "Salva prodotto"}</Button></form>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1.5" {...props} />{hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}
