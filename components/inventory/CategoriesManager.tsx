"use client";

import { userErrorMessage } from "@/lib/user-errors";

import { useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCategory, deleteCategory, renameCategory } from "@/lib/inventory/api";
import type { Product } from "@/types/inventory";
import { ConfirmAction } from "./ConfirmAction";

export function CategoriesManager({ categories, products, onChanged }: { categories: string[]; products: Product[]; onChanged: () => Promise<void> }) {
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [removeProducts, setRemoveProducts] = useState(false);
  const count = (category: string) => products.filter((product) => product.category === category).length;
  const save = async (event: React.FormEvent, category?: string) => {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try {
      if (category !== undefined) { await renameCategory(category, name); setName(""); setEditing(null); } else { await createCategory(newName); setNewName(""); }
      await onChanged();
    } catch (cause) { setError(userErrorMessage(cause, "Impossibile salvare la categoria.")); }
    finally { pending.current = false; setBusy(false); }
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>Gestisci categorie</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto" showCloseButton={!busy}>
        <DialogHeader><DialogTitle>Categorie</DialogTitle><DialogDescription>Crea, rinomina o elimina una categoria e scegli cosa fare dei suoi prodotti.</DialogDescription></DialogHeader>
        <form onSubmit={event => save(event)} className="flex flex-wrap items-end gap-2"><label className="min-w-40 flex-1 text-sm font-medium">Nuova categoria<Input className="mt-1.5" value={newName} onChange={event => setNewName(event.target.value)} required disabled={busy} /></label><Button disabled={busy || !newName.trim()}><Plus className="h-4 w-4" />Crea categoria</Button></form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="divide-y">{categories.map(category => <div key={category} className="flex flex-wrap items-center gap-3 py-3">{editing === category ?
          <form className="flex w-full flex-wrap items-end gap-2" onSubmit={event => save(event, category)}><label className="min-w-40 flex-1 text-sm font-medium">Rinomina {category}<Input autoFocus className="mt-1.5" value={name} onChange={event => setName(event.target.value)} required disabled={busy} /></label><Button disabled={busy || !name.trim() || name.trim() === category}>Salva nome</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(null); setName(""); }}>Annulla</Button></form>
          : <><div className="min-w-0 flex-1"><p className="break-words font-medium">{category}</p><p className="text-xs text-muted-foreground">{count(category)} prodotti</p></div><Button size="sm" variant="outline" disabled={busy} aria-label={`Rinomina ${category}`} onClick={() => { setEditing(category); setName(category); setError(""); }}><Pencil className="h-4 w-4" />Rinomina</Button><Button size="icon" variant="outline" disabled={busy} aria-label={`Elimina ${category}`} onClick={() => { setDeleting(category); setRemoveProducts(false); }}><Trash2 className="h-4 w-4" /></Button></>}</div>)}</div>
        {!categories.length && <p className="text-sm text-muted-foreground">Nessuna categoria. Creane una qui oppure durante l’inserimento di un prodotto.</p>}
      </DialogContent>
    </Dialog>
    <ConfirmAction open={deleting !== null} onOpenChange={(next) => { if (!next) setDeleting(null); }} title={`Eliminare ${deleting ?? "la categoria"}?`} description={removeProducts ? `Verranno eliminati tutti i ${count(deleting ?? "")} prodotti della categoria. L’operazione non è annullabile; gli ordini conservano i dati storici.` : "La categoria verrà eliminata. I prodotti resteranno in magazzino senza categoria."} label={removeProducts ? "Elimina categoria e prodotti" : "Elimina solo categoria"} onConfirm={async () => { if (deleting !== null) { await deleteCategory(deleting, removeProducts, count(deleting)); setEditing(null); setName(""); await onChanged(); } }}>
      <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={removeProducts} onChange={(event) => setRemoveProducts(event.target.checked)} />Elimina anche tutti i prodotti di questa categoria</label>
    </ConfirmAction>
  </>;
}
