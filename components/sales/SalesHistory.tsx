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
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button asChild><Link href="/codici/vendite">Apri carrello vendita</Link></Button><Button asChild variant="outline"><Link href="/codici/riordino">Da riordinare</Link></Button></div><form className="grid items-end gap-3 rounded-xl border p-4 sm:grid-cols-4" onSubmit={e=>{e.preventDefault();void load();}}><label className="text-sm">Numero, cliente o prodotto<Input className="mt-1" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="text-sm">Dal<Input className="mt-1" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">Al<Input className="mt-1" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><Button disabled={loading}>Cerca vendite</Button></form>{error&&<p role="alert" className="text-destructive">{error}</p>}{loading?<p>Caricamento vendite…</p>:<><p className="text-sm text-muted-foreground">{sales.length} vendite · Totale vendite confermate: {money(centsDecimal(sales.filter(s=>s.status==='closed').reduce((sum,s)=>sum+lineCents('1',s.total,'0'),0n)))}</p><div className="grid gap-3">{sales.map(s=><Link key={s.id} href={`/codici/vendite/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"><div><h2 className="font-semibold">{saleLabel(s)} {s.status==='void'&&<span className="text-destructive">· Annullata</span>}</h2><p className="text-sm">{s.client_snapshot.name||s.customer_name||'Cliente al banco'}</p><p className="text-xs text-muted-foreground">{saleDate(s.closed_at!)} · {s.operator_name}</p></div><span className="font-semibold tabular-nums">{money(s.total)}</span></Link>)}</div>{sales.length===0&&<p className="rounded-xl border border-dashed p-8 text-center">Nessuna vendita corrisponde alla ricerca.</p>}</>}</div>;
}
