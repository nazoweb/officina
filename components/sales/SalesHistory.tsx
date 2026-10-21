"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { listSales } from '@/lib/sales/api';
import { userErrorMessage } from '@/lib/user-errors';
import { money, centsDecimal, lineCents } from '@/lib/ddt/money';
import { saleDate, saleLabel, type Sale } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function SalesHistory(){
  const [sales,setSales]=useState<Sale[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const pending=useRef(false);
  const load=async()=>{if(pending.current)return;pending.current=true;setLoading(true);setError('');try{setSales(await listSales({query,from,to}));}catch(cause){setError(userErrorMessage(cause));}finally{pending.current=false;setLoading(false);}};
  useEffect(()=>{void load();},[]);
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button asChild><Link href="/codici/vendite">Carrello vendita</Link></Button><Button asChild variant="outline"><Link href="/codici/riordino">Da riordinare</Link></Button></div><form className="grid items-end gap-3 rounded-xl border p-4 grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={e=>{e.preventDefault();void load();}}><label className="col-span-2 min-w-0 text-sm lg:col-span-1">Cerca vendita<Input placeholder="Numero, cliente o prodotto…" className="mt-1 h-11" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="min-w-0 text-sm">Dal<Input className="mt-1 h-11 min-w-0" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="min-w-0 text-sm">Al<Input className="mt-1 h-11 min-w-0" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><Button className="col-span-2 h-11 lg:col-span-1" disabled={loading}>Cerca</Button></form>{error&&<p role="alert" className="text-destructive">{error}</p>}{loading?<p>Caricamento vendite…</p>:<><p className="text-sm text-muted-foreground">{sales.length} {sales.length===1?'vendita':'vendite'} · Totale confermate: {money(centsDecimal(sales.filter(s=>s.status==='closed').reduce((sum,s)=>sum+lineCents('1',s.total,'0'),0n)))}</p><div className="grid gap-3">{sales.map(s=><Link key={s.id} href={`/codici/vendite/${s.id}`} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"><div className="min-w-0 break-words"><h2 className="font-semibold">{saleLabel(s)} {s.status==='void'&&<span className="text-destructive">· Annullata</span>}</h2><p className="text-sm">{s.client_snapshot.name||s.customer_name||'Cliente al banco'}</p><p className="text-xs text-muted-foreground">{saleDate(s.closed_at!)} · {s.operator_name}</p></div><span className="shrink-0 font-semibold tabular-nums">{money(s.total)}</span></Link>)}</div>{sales.length===0&&<p className="rounded-xl border border-dashed p-8 text-center">Nessuna vendita corrisponde alla ricerca.</p>}</>}</div>;
}
