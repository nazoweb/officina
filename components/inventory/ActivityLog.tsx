"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { activityLabels } from "@/lib/inventory/activity";
import { userErrorMessage } from "@/lib/user-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Event = { id: string; created_at: string; actor_id: string; session_id: string; action: string; status: string; route: string; metadata: Record<string, unknown>; user_message: string | null };
export function ActivityLog() {
  const [events, setEvents] = useState<Event[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [onlyErrors, setOnlyErrors] = useState(false); const [search, setSearch] = useState("");
  const reload = async () => {
    setBusy(true); setError("");
    try {
      let query = createSupabaseBrowserClient().from("activity_events").select("id,created_at,actor_id,session_id,action,status,route,metadata,user_message").order("created_at", { ascending: false }).limit(200);
      if (onlyErrors) query = query.eq("status", "error");
      if (search.trim()) { const prefix = search.trim().toLowerCase(); if (!/^[0-9a-f]{8}$/.test(prefix)) { setError("Inserisci le 8 lettere e cifre del riferimento mostrato nel messaggio di errore."); return; } query = query.gte("id", `${prefix}-0000-0000-0000-000000000000`).lte("id", `${prefix}-ffff-ffff-ffff-ffffffffffff`); }
      const { data, error } = await query; if (error) throw error; setEvents(data as Event[]);
    } catch (cause) { setError(userErrorMessage(cause, "Il registro non è disponibile. Riprova tra poco.")); }
    finally { setBusy(false); }
  };
  useEffect(() => { void reload(); }, [onlyErrors]);
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Ultime 200 attività. Cerca il riferimento di un errore per ritrovare cosa è successo. Le attività dello stesso accesso hanno la stessa sessione.</p><form onSubmit={event => { event.preventDefault(); void reload(); }} className="flex flex-wrap items-center gap-3"><Input className="max-w-xs" aria-label="Riferimento assistenza" placeholder="Es. A12B34C5" value={search} onChange={event => setSearch(event.target.value)} /><Button disabled={busy}>{busy ? "Caricamento…" : "Aggiorna registro"}</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyErrors} onChange={event => setOnlyErrors(event.target.checked)} />Solo problemi</label></form>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="space-y-3">{events.map(event => <article key={event.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{activityLabels[event.action] || "Attività del sito"}</p><span className={event.status === "error" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{event.status === "error" ? "Problema" : "Completata"}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(event.created_at))} · Riferimento {event.id.slice(0,8).toUpperCase()}</p>{event.user_message && <p className="mt-2 text-sm">{event.user_message}</p>}<details className="mt-2 text-xs"><summary className="cursor-pointer">Dettagli attività</summary><p className="mt-2 break-all">Pagina: {event.route} · Sessione: {event.session_id?.slice(0,8)} · Utente: {event.actor_id.slice(0,8)}</p><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(event.metadata, null, 2)}</pre></details></article>)}{!busy && !error && !events.length && <p className="text-sm text-muted-foreground">Nessuna attività trovata.</p>}</div></div>;
}
