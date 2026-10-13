"use client";

import { userErrorMessage } from "@/lib/user-errors";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { closeOrder, createOrder, findProductsByCode, getOrder, listOrders, scanProductIntoOrder, setOrderItemQuantity } from "@/lib/inventory/api";
import type { OrderDetail, OrderSummary, Product } from "@/types/inventory";
import { CheckCircle2, ClipboardList, Minus, Plus, ScanBarcode, X } from "lucide-react";

import { OrderActions } from "./OrderActions";

function totalQuantity(order: OrderSummary) { return order.order_items?.reduce((total, item) => total + item.quantity, 0) ?? 0; }

export function OrdersList() {
  const submitting = useRef(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]); const [name, setName] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState(""); const [creating, setCreating] = useState(false);
  const reload = () => listOrders().then(setOrders).catch((cause) => setError(userErrorMessage(cause)));
  useEffect(() => { reload(); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || submitting.current) return; submitting.current = true; setCreating(true); try { const order = await createOrder(name, notes); window.location.assign(`/codici/ordini/${order.id}`); } catch (cause) { setError(userErrorMessage(cause, "Impossibile creare la lista.")); } finally { submitting.current = false; setCreating(false); } };
  return <div className="space-y-6"><form onSubmit={submit} className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Nuova lista ordini</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Ordine ricambi del 17 settembre" autoFocus /><Button disabled={creating || !name.trim()}><Plus className="mr-2 h-4 w-4" />Apri lista</Button></div><Textarea className="mt-3 min-h-12" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note facoltative" /></form>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<div className="grid gap-3">{orders.map((order) => <div key={order.id} className="space-y-2 rounded-xl border bg-card p-4"><Link href={`/codici/ordini/${order.id}`} className="block rounded-md transition-colors hover:bg-muted/40"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">#{order.order_number}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${order.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{order.status === "open" ? "Aperta" : "Chiusa"}</span></div><h2 className="mt-1 font-semibold">{order.name}</h2><p className="mt-1 text-xs text-muted-foreground">Aggiornata {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.updated_at))}</p></div><div className="text-right"><p className="text-lg font-bold tabular-nums">{totalQuantity(order)}</p><p className="text-xs text-muted-foreground">pezzi</p></div></div></Link><OrderActions order={order} onChanged={reload} onDeleted={reload} /></div>)}{orders.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nessuna lista ordine</p><p className="mt-1 text-sm text-muted-foreground">Apri la prima lista per iniziare a registrare le scansioni.</p></div>}</div></div>;
}

export function OrderWorkspace({ orderId }: { orderId: string }) {
  const pending = useRef(false); const [busy, setBusy] = useState(false);
  const router = useRouter(); const scanner = useRef<HTMLInputElement>(null); const [order, setOrder] = useState<OrderDetail | null>(null); const [value, setValue] = useState(""); const [matches, setMatches] = useState<Product[]>([]); const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const reload = async () => { setLoading(true); try { setOrder(await getOrder(orderId)); } catch (cause) { setError(userErrorMessage(cause, "Impossibile caricare la lista.")); } finally { setLoading(false); setTimeout(() => scanner.current?.focus(), 0); } };
  useEffect(() => { reload(); }, [orderId]);
  // Scans are queued, so a second read made while the first is being saved is never lost.
  const queue = useRef<string[]>([]);
  const processQueue = async () => {
    if (!order || pending.current) return;
    pending.current = true; setBusy(true); setNotice(""); setError("");
    const problems: string[] = []; const added: string[] = [];
    try {
      while (queue.current.length) {
        const code = queue.current.shift()!;
        try {
          const found = await findProductsByCode(code);
          if (!found.length) { problems.push(`Nessun prodotto associato al codice ${code}. Controlla il codice oppure crea il prodotto prima di aggiungerlo.`); continue; }
          if (found.length > 1) {
            setMatches(found);
            if (queue.current.length) problems.push(`${queue.current.length} scansioni successive non sono state registrate: scegli il prodotto corretto, poi ripetile.`);
            queue.current = []; break;
          }
          await scanProductIntoOrder(order.id, found[0].id);
          added.push(found[0].name || found[0].internal_code);
        } catch (cause) { problems.push(`${code}: ${userErrorMessage(cause, "Non riesco a leggere questo codice. Riprova.")}`); }
      }
      if (added.length) { setMatches([]); setNotice(added.length === 1 ? `${added[0]} aggiunto alla lista.` : `${added.length} scansioni aggiunte alla lista.`); }
      setError(problems.join(" "));
      if (added.length) await reload();
    } finally { pending.current = false; setBusy(false); setTimeout(() => scanner.current?.focus(), 0); drainQueue(); }
  };
  // Reads that arrived while another operation was running are processed as soon as it ends.
  const drainQueue = () => { if (queue.current.length) setTimeout(() => void processQueue(), 0); };
  const scan = (event: React.FormEvent) => {
    event.preventDefault(); const code = value.trim(); if (!code || !order) return;
    queue.current.push(code); setValue(""); void processQueue();
  };
  const choose = async (product: Product) => {
    if (!order || pending.current) return; pending.current = true; setBusy(true); setError("");
    try { await scanProductIntoOrder(order.id, product.id); setNotice(`${product.name || product.internal_code} aggiunto alla lista.`); setMatches([]); await reload(); }
    catch (cause) { setError(userErrorMessage(cause, "Impossibile aggiungere il prodotto.")); }
    finally { pending.current = false; setBusy(false); setTimeout(() => scanner.current?.focus(), 0); drainQueue(); }
  };
  const changeQuantity = async (itemId: string, quantity: number) => {
    if (pending.current) return;
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) { setError("Inserisci una quantità intera tra 0 e 2.147.483.647. Usa 0 per rimuovere il prodotto."); return; }
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try { await setOrderItemQuantity(itemId, quantity); await reload(); } catch (cause) { setError(userErrorMessage(cause)); }
    finally { pending.current = false; setBusy(false); drainQueue(); }
  };
  const finish = async () => { if (!order || pending.current) return; pending.current = true; setBusy(true); setError(""); try { await closeOrder(order.id); await reload(); } catch (cause) { setError(userErrorMessage(cause)); } finally { pending.current = false; setBusy(false); drainQueue(); } };

  if (loading && !order) return <p className="text-sm text-muted-foreground">Caricamento lista…</p>; if (!order) return <p className="text-sm text-destructive">{error || "Lista non trovata."}</p>;
  const open = order.status === "open"; const total = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono text-sm text-muted-foreground">#{order.order_number}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${open ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{open ? "Lista aperta" : "Lista chiusa"}</span></div><h1 className="mt-1 text-2xl font-semibold">{order.name}</h1>{order.notes && <p className="mt-1 text-sm text-muted-foreground">{order.notes}</p>}</div><div className="flex flex-wrap gap-2"><OrderActions order={order} onChanged={reload} onDeleted={() => router.push("/codici/ordini")} />{open && <Button disabled={busy} onClick={finish}><CheckCircle2 className="mr-2 h-4 w-4" />Chiudi lista</Button>}</div></div>
    {open && <form onSubmit={scan} className="rounded-xl border-2 border-primary/30 bg-card p-4"><label className="mb-2 flex items-center gap-2 text-sm font-semibold"><ScanBarcode className="h-4 w-4 text-primary" />Scansiona un prodotto</label><div className="flex gap-2"><Input ref={scanner} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Punta qui la pistola barcode…" className="h-12 font-mono text-base" autoFocus /><Button className="h-12" disabled={!value.trim()}>{busy ? "Registrazione…" : "Aggiungi"}</Button></div></form>}
    {notice && <Alert className="border-emerald-500/30 bg-emerald-500/5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription>{notice}</AlertDescription></Alert>}{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {matches.length > 0 && <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Scegli il prodotto corretto</h2><p className="text-sm text-muted-foreground">Questo codice è associato a più prodotti.</p></div><Button variant="ghost" size="icon" onClick={() => setMatches([])}><X className="h-4 w-4" /></Button></div><div className="mt-3 grid gap-2">{matches.map((product) => <Button key={product.id} variant="outline" className="h-auto justify-start py-3 text-left" disabled={busy} onClick={() => choose(product)}><span><span className="block font-mono text-xs text-muted-foreground">{product.internal_code}</span><span>{product.name || "Prodotto senza nome"}</span></span></Button>)}</div></section>}
    <section className="overflow-hidden rounded-xl border bg-card"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Prodotti nella lista</h2><span className="text-sm text-muted-foreground">{total} pezzi</span></div><div className="divide-y">{order.order_items.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="min-w-40 flex-1"><p className="font-mono text-xs text-muted-foreground">{item.internal_code_snapshot}</p><p className="truncate font-medium">{item.product_name_snapshot || "Prodotto senza nome"}</p>{item.product?.product_identifiers.filter((identifier) => identifier.kind === "supplier_code").map((identifier) => <p key={identifier.id} className="font-mono text-xs text-muted-foreground">Codice fornitore: {identifier.value}</p>)}{!item.product && <p className="text-xs text-muted-foreground">Prodotto eliminato dal catalogo</p>}{item.product && <p className={`text-xs ${item.product.stock_quantity < 0 ? "text-destructive" : "text-muted-foreground"}`}>Giacenza: {item.product.stock_quantity} {item.product.unit}</p>}</div>{open ? <div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-9 w-9" disabled={busy} onClick={() => changeQuantity(item.id, item.quantity - 1)}><Minus className="h-4 w-4" /></Button><form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); const quantity = Number(new FormData(event.currentTarget).get("quantity")); if (Number.isInteger(quantity) && quantity >= 0) void changeQuantity(item.id, quantity); else setError("Inserisci una quantità intera, a partire da zero."); }}><Input key={item.quantity} className="w-20" disabled={busy} name="quantity" type="number" min="0" step="1" required defaultValue={item.quantity} aria-label={`Quantità ${item.internal_code_snapshot}`} /><Button disabled={busy} size="sm" variant="outline">Salva</Button></form><Button size="icon" variant="outline" className="h-9 w-9" disabled={busy} onClick={() => changeQuantity(item.id, item.quantity + 1)}><Plus className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Rimuovi ${item.internal_code_snapshot}`} disabled={busy} onClick={() => changeQuantity(item.id, 0)}><X className="h-4 w-4" /></Button></div> : <span className="font-bold tabular-nums">× {item.quantity}</span>}</div>)}{order.order_items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">{open ? "Scansiona il primo prodotto per aggiungerlo alla lista." : "Questa lista non contiene prodotti."}</p>}</div></section></div>;
}
