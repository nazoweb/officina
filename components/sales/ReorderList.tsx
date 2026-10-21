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
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{onToggle&&<th className="p-3"><span className="sr-only">Selezione</span></th>}{['Venduta il','Vendita','Codice / articolo','Quantità','Fornitore / codice'].map(label=><th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{lines.map(line=><tr key={line.id} className="border-t">{onToggle&&<td className="p-3"><input type="checkbox" aria-label={`Seleziona ${line.code} vendita ${line.sale_number}/${line.sale_year}`} checked={selected?.includes(line.id)} onChange={()=>onToggle(line.id)}/></td>}<td className="whitespace-nowrap p-3">{saleDate(line.sold_at)}</td><td className="p-3"><Link className="underline" href={`/codici/vendite/${line.sale_id}`}>{line.sale_number}/{line.sale_year}</Link>{line.sale_status==='void'&&<p className="text-xs font-medium text-destructive">Annullata: da verificare</p>}</td><td className="min-w-48 p-3"><p className="font-mono text-xs">{line.code}</p><p>{line.description}</p></td><td className="whitespace-nowrap p-3 font-semibold">{line.quantity} {line.unit}</td><td className="p-3"><p>{line.supplier||'—'}</p><p className="font-mono text-xs">{line.supplier_code}</p></td></tr>)}</tbody></table></div>;
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
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/codici/vendite">Carrello vendita</Link></Button><Button asChild variant="outline"><Link href="/codici/vendite/storico">Storico vendite</Link></Button><Button variant="outline" disabled={loading||busy} onClick={load}>Aggiorna lista</Button></div><p className="text-sm text-muted-foreground">Qui rimangono i ricambi delle vendite chiuse, con data e quantità. La lista non scade. Stampare salva una copia nello storico e lascia tutte le voci in lista; rimuovile manualmente quando le hai riordinate.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}
    <section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{lines.length} voci · {lines.reduce((sum,l)=>sum+l.quantity,0)} pezzi da verificare</p><Button disabled={loading||busy||!lines.length} onClick={print}>{busy?'Salvataggio stampa…':'Stampa lista e salva nello storico'}</Button></div><p className="text-xs text-muted-foreground">La stampa comprende l’intera lista, anche quando stai usando un filtro. Nessuna voce viene eliminata.</p><Input aria-label="Filtra lista da riordinare" placeholder="Cerca codice, prodotto o fornitore…" value={query} onChange={e=>{setQuery(e.target.value);setSelected([]);}}/>
      {filtered.length>0&&<div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Seleziona tutte le voci visibili" checked={all} disabled={busy} onChange={e=>setSelected(e.target.checked?filtered.map(l=>l.id):[])}/>Seleziona tutte le voci visibili</label><Button variant="outline" className="text-destructive" disabled={busy||!selected.length} onClick={()=>setConfirm(true)}>Elimina dalla lista ({selected.length})</Button></div>}
    </section>
    {loading?<p>Caricamento lista…</p>:filtered.length?<ReorderTable lines={filtered} selected={selected} onToggle={id=>{if(!busy)setSelected(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);}}/>:<p className="rounded-xl border border-dashed p-8 text-center">{lines.length?'Nessuna voce corrisponde al filtro.':'La lista da riordinare è vuota.'}</p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Storico delle stampe</h2><p className="text-sm text-muted-foreground">Ogni copia conserva le voci presenti al momento della stampa, anche dopo la loro rimozione dalla lista corrente.</p>{prints.map(p=><Link key={p.id} href={`/codici/riordino/stampe/${p.id}`} className="block rounded-xl border bg-card p-4 hover:bg-muted/30"><span className="font-semibold">Stampa {p.print_number}</span><p className="text-sm">{saleDate(p.created_at)} · {p.operator_name}</p></Link>)}{!loading&&!prints.length&&<p className="text-sm text-muted-foreground">Nessuna stampa salvata.</p>}</section>
    <ConfirmAction open={confirm} onOpenChange={setConfirm} title="Rimuovere le voci dalla lista?" description={`Rimuoverai ${selected.length} voci soltanto dalla lista corrente. Storico vendite, stampe salvate e magazzino rimarranno invariati.`} label="Conferma rimozione dalla lista" onConfirm={async()=>{if(pending.current)return;pending.current=true;setBusy(true);try{await removeReorder(selected);await load();}finally{pending.current=false;setBusy(false);}}}/>
  </div>;
}
