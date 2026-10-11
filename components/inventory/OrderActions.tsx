"use client";

import { userErrorMessage } from "@/lib/user-errors";

import { useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteOrder, updateOrder } from "@/lib/inventory/api";
import type { OrderSummary } from "@/types/inventory";
import { ConfirmAction } from "./ConfirmAction";

export function OrderActions({ order, onChanged, onDeleted }: { order: OrderSummary; onChanged: () => void | Promise<void>; onDeleted: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(order.name);
  const [notes, setNotes] = useState(order.notes);
  const [status, setStatus] = useState(order.status);
  const [restore, setRestore] = useState(true);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await updateOrder(order, name, notes, status); setEditing(false); await onChanged(); }
    catch (cause) { setError(userErrorMessage(cause, "Impossibile salvare la lista.")); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={() => { setName(order.name); setNotes(order.notes); setStatus(order.status); setError(""); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" />Modifica lista</Button>
    <Button variant="outline" className="text-destructive" onClick={() => { setRestore(true); setDeleting(true); }}><Trash2 className="mr-2 h-4 w-4" />Elimina lista</Button>
    <Dialog open={editing} onOpenChange={(next) => { if (!busy) setEditing(next); }}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Modifica lista #{order.order_number}</DialogTitle><DialogDescription>Aggiorna nome e note. Puoi riaprire una lista chiusa per modificare i suoi prodotti.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><fieldset className="space-y-4" disabled={busy}><label className="block text-sm font-medium">Nome<Input className="mt-1.5" required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium">Note<Textarea className="mt-1.5" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><label className="block text-sm font-medium">Stato<select className="mt-1.5 h-9 w-full rounded-md border bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value as OrderSummary["status"])}><option value="open">Aperta</option><option value="closed">Chiusa</option></select></label></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy || !name.trim()}>{busy ? "Salvataggio…" : "Salva lista"}</Button></form></DialogContent></Dialog>
    <ConfirmAction open={deleting} onOpenChange={setDeleting} title={`Eliminare la lista #${order.order_number}?`} description={restore ? "La lista verrà eliminata e le quantità dei prodotti ancora presenti verranno restituite al magazzino. L’operazione non è annullabile." : "La lista verrà eliminata senza cambiare le quantità in magazzino. L’operazione non è annullabile."} label="Elimina lista" onConfirm={async () => { await deleteOrder(order.id, restore); await onDeleted(); }}>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={restore} onChange={(event) => setRestore(event.target.checked)} className="mt-1" />Restituisci le quantità al magazzino</label>
    </ConfirmAction>
  </div>;
}
