"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getReorderPrint } from '@/lib/sales/api';
import { userErrorMessage } from '@/lib/user-errors';
import { saleDate, type ReorderPrint } from '@/types/sales';
import { ReorderTable } from './ReorderList';
import { PdfActions } from './PdfActions';
export function ReorderPrintDetail({id}:{id:string}){
  const [snapshot,setSnapshot]=useState<ReorderPrint|null>(null);const [error,setError]=useState('');
  useEffect(()=>{let active=true;getReorderPrint(id).then(s=>{if(active)setSnapshot(s);}).catch(c=>{if(active)setError(userErrorMessage(c));});return()=>{active=false;};},[id]);
  if(!snapshot)return error?<p role="alert" className="text-destructive">{error}</p>:<p>Caricamento stampa…</p>;
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Stampa {snapshot.print_number} · Da riordinare</h1><p className="mt-1 text-sm text-muted-foreground">{saleDate(snapshot.created_at)} · {snapshot.operator_name}</p></div><p className="rounded-xl border bg-muted/30 p-4 text-sm">Questa è la copia storica della lista: {snapshot.lines.length} voci, {snapshot.lines.reduce((n,l)=>n+l.quantity,0)} pezzi. Le voci sono rimaste nella lista corrente e si possono rimuovere solo manualmente.</p><PdfActions snapshot={snapshot}/><ReorderTable lines={snapshot.lines}/><Button asChild variant="outline"><Link href="/codici/riordino">Torna alla lista corrente e allo storico</Link></Button></div>;
}
