"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankParty, type BusinessClient } from "@/types/ddt";
import { saveClient } from "@/lib/ddt/api";
import { userErrorMessage } from "@/lib/user-errors";
import { PartyFields } from "./PartyFields";

export function NewClientDialog({ onCreated, disabled = false }: { onCreated: (client: BusinessClient) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...blankParty, delivery_address: "", active: true });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const close = (next: boolean) => {
    if (busy) return;
    if (!next && dirty && !window.confirm("Scartare i dati della nuova azienda?")) return;
    setOpen(next);
  };
  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => { setDraft({ ...blankParty, delivery_address: "", active: true }); setDirty(false); setError(""); setOpen(true); }}>Nuova azienda</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Nuova azienda</DialogTitle><DialogDescription>Salva l’azienda e continua da qui, senza perdere il lavoro in corso.</DialogDescription></DialogHeader>
      <form className="space-y-4" onChange={() => setDirty(true)} onSubmit={async event => {
        event.preventDefault(); event.stopPropagation(); if (pending.current) return; pending.current = true; setBusy(true); setError("");
        try {
          const id = await saveClient(draft);
          // This local record is used only to select the new recipient. Its authoritative
          // updated_at is loaded by the company management page before any later edits.
          onCreated({ ...draft, name: draft.name.trim(), id, updated_at: "" });
          setDirty(false); setOpen(false);
        } catch (cause) { setError(userErrorMessage(cause)); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <fieldset disabled={busy} className="space-y-4"><PartyFields party={draft} onChange={party => setDraft({ ...draft, ...party })} />
          <label className="block text-sm font-medium">Indirizzo di consegna (se diverso)<Input className="mt-1.5" maxLength={300} value={draft.delivery_address} onChange={event => setDraft({ ...draft, delivery_address: event.target.value })} /></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="sticky -bottom-6 flex flex-wrap gap-2 border-t bg-background py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>Annulla</Button>
          <Button disabled={busy}>{busy ? "Salvataggio…" : "Salva e seleziona azienda"}</Button>
        </div>
      </form>
    </DialogContent></Dialog>
  </>;
}
