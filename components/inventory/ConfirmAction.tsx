"use client";

import { userErrorMessage } from "@/lib/user-errors";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ConfirmAction({ open, onOpenChange, title, description, label = "Elimina", onConfirm, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  label?: string; onConfirm: () => Promise<void>; children?: React.ReactNode;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    if (pending.current) return; pending.current = true;
    setBusy(true); setError("");
    try { await onConfirm(); onOpenChange(false); }
    catch (cause) { setError(userErrorMessage(cause, "Operazione non riuscita.")); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) { setError(""); onOpenChange(next); } }}>
    <DialogContent showCloseButton={!busy}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Annulla</Button><Button variant="destructive" disabled={busy} onClick={confirm}>{busy ? "Operazione in corso…" : label}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
