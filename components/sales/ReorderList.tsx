"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmAction } from '@/components/inventory/ConfirmAction';
import { listReorder, listReorderPrints, removeReorder, snapshotReorder } from '@/lib/sales/api';
import { userErrorMessage } from '@/lib/user-errors';
import { saleDate, type ReorderEntry, type ReorderPrintSummary } from '@/types/sales';
export function ReorderTable({lines,selected,onToggle}:{lines:ReorderEntry[];selected?:string[];onToggle?:(id:string)=>void}){
  const selection=(line:ReorderEntry)=><label className="flex min-h-11 min-w-11 items-center justify-center"><input className="h-4 w-4 accent-primary" type="checkbox" aria-label={`Seleziona ${line.code} vendita ${line.sale_number}/${line.sale_year}`} checked={selected?.includes(line.id)??false} onChange={()=>onToggle?.(line.id)}/></label>;
  return <><div className="grid gap-3 xl:hidden">{lines.map(line=><article key={line.id} className="rounded-xl border bg-card p-4"><div className="flex items-start gap-2">{onToggle&&selection(line)}<div className="min-w-0 flex-1"><p className="break-words font-mono text-xs text-muted-foreground">{line.code}</p><h3 className="break-words font-semibold">{line.description}</h3></div><p className="shrink-0 font-semibold tabular-nums">{line.quantity} {line.unit}</p></div><div className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground"><p>Vendita <Link className="underline underline-offset-2" href={`/codici/vendite/${line.sale_id}`}>{line.sale_number}/{line.sale_year}</Link> · {saleDate(line.sold_at)}</p>{line.supplier&&<p className="break-words">{line.supplier}{line.supplier_code&&<> · <span className="font-mono">{line.supplier_code}</span></>}</p>}{line.sale_status==='void'&&<p className="font-medium text-destructive">Vendita annullata: da verificare</p>}</div></article>)}</div><div className="hidden overflow-x-auto rounded-xl border xl:block"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{onToggle&&<th><span className="sr-only">Selezione</span></th>}{['Codice / articolo','Quantità','Vendita / data','Fornitore / codice'].map(label=><th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{lines.map(line=><tr key={line.id} className="border-t">{onToggle&&<td>{selection(line)}</td>}<td className="min-w-48 p-3"><p className="font-mono text-xs text-muted-foreground">{line.code}</p><p className="font-medium">{line.description}</p></td><td className="whitespace-nowrap p-3 font-semibold tabular-nums">{line.quantity} {line.unit}</td><td className="p-3"><Link className="underline underline-offset-2" href={`/codici/vendite/${line.sale_id}`}>{line.sale_number}/{line.sale_year}</Link><p className="whitespace-nowrap text-xs text-muted-foreground">{saleDate(line.sold_at)}</p>{line.sale_status==='void'&&<p className="text-xs font-medium text-destructive">Annullata: da verificare</p>}</td><td className="p-3"><p>{line.supplier||'—'}</p><p className="font-mono text-xs text-muted-foreground">{line.supplier_code}</p></td></tr>)}</tbody></table></div></>;

}
export function ReorderList(){
  const router=useRouter();const pending=useRef(false);const printRequest=useRef<string|null>(null);
  const [lines,setLines]=useState<ReorderEntry[]>([]);const [prints,setPrints]=useState<ReorderPrintSummary[]>([]);const [selected,setSelected]=useState<string[]>([]);
  const [query,setQuery]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
  const load=async()=>{setLoading(true);setError('');try{const [items,history]=await Promise.all([listReorder(),listReorderPrints()]);setLines(items);setPrints(history);setSelected([]);}catch(cause){setError(userErrorMessage(cause));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const filtered=lines.filter(l=>`${l.code} ${l.description} ${l.supplier} ${l.supplier_code}`.toUpperCase().includes(query.trim().toUpperCase()));
  const all=filtered.length>0&&filtered.every(l=>selected.includes(l.id));
  const print=async()=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{
      // Store the request before sending: after an uncertain response, retry returns the same snapshot.
      if(!printRequest.current){try{printRequest.current=sessionStorage.getItem('officina-reorder-print-request');}catch{/* Session storage is optional. */}}
      if(!printRequest.current)printRequest.current=crypto.randomUUID();
      try{sessionStorage.setItem('officina-reorder-print-request',printRequest.current);}catch{/* Optional. */}
      const snapshot=await snapshotReorder(printRequest.current);
      try{sessionStorage.removeItem('officina-reorder-print-request');}catch{/* Optional. */}
      router.push(`/codici/riordino/stampe/${snapshot.id}`);
    }catch(cause){setError(userErrorMessage(cause));}finally{pending.current=false;setBusy(false);}
  };
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/codici/vendite">Carrello vendita</Link></Button><Button asChild variant="outline"><Link href="/codici/vendite/storico">Storico vendite</Link></Button></div><p className="text-sm text-muted-foreground">La stampa salva una copia nello storico. Le voci restano qui finché le elimini dopo il riordino.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}
    <section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center gap-3"><p className="font-semibold">{lines.length} voci · {lines.reduce((sum,l)=>sum+l.quantity,0)} pezzi</p></div><div className="flex flex-wrap gap-2"><Button className="h-11" disabled={loading||busy||!lines.length} onClick={print}>{busy?'Salvataggio stampa…':'Stampa lista'}</Button><Button className="h-11" variant="outline" disabled={loading||busy} onClick={load}>Aggiorna</Button></div>{query.trim()&&<p className="text-xs text-muted-foreground">La stampa comprende tutta la lista, anche le voci nascoste dal filtro.</p>}<Input aria-label="Filtra lista da riordinare" placeholder="Cerca codice, prodotto o fornitore…" value={query} onChange={e=>{setQuery(e.target.value);setSelected([]);}}/>
      {filtered.length>0&&<div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input className="h-4 w-4 accent-primary" type="checkbox" aria-label="Seleziona tutte le voci visibili" checked={all} disabled={busy} onChange={e=>setSelected(e.target.checked?filtered.map(l=>l.id):[])}/>Seleziona tutte</label>{selected.length>0&&<Button variant="outline" className="text-destructive dark:text-red-400" disabled={busy||!selected.length} onClick={()=>setConfirm(true)}>Elimina dalla lista ({selected.length})</Button>}</div>}
    </section>
    {loading?<p>Caricamento lista…</p>:filtered.length?<ReorderTable lines={filtered} selected={selected} onToggle={id=>{if(!busy)setSelected(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);}}/>:<p className="rounded-xl border border-dashed p-8 text-center">{lines.length?'Nessuna voce corrisponde al filtro.':'La lista da riordinare è vuota.'}</p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Storico delle stampe</h2><p className="text-sm text-muted-foreground">Le liste stampate restano consultabili e ristampabili.</p>{prints.map(p=><Link key={p.id} href={`/codici/riordino/stampe/${p.id}`} className="block rounded-xl border bg-card p-4 hover:bg-muted/30"><span className="font-semibold">Stampa {p.print_number}</span><p className="text-sm text-muted-foreground">{saleDate(p.created_at)} · {p.operator_name}</p></Link>)}{!loading&&!prints.length&&<p className="text-sm text-muted-foreground">Nessuna stampa salvata.</p>}</section>
    <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Rimuovere le voci dalla lista?" description={`Rimuoverai ${selected.length} voci soltanto dalla lista corrente. Storico vendite, stampe salvate e magazzino rimarranno invariati.`} label="Conferma rimozione dalla lista" onConfirm={async()=>{if(pending.current)return;pending.current=true;setBusy(true);try{await removeReorder(selected);await load();}finally{pending.current=false;setBusy(false);}}}/>
  </div>;
}
