"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmAction } from '@/components/inventory/ConfirmAction';
import { getSale, voidSale, createSaleDdt } from '@/lib/sales/api';
import { money } from '@/lib/ddt/money';
import { userErrorMessage } from '@/lib/user-errors';
import { saleDate, saleLabel, type Sale } from '@/types/sales';
import { PdfActions } from './PdfActions';
export function SaleDetail({id}:{id:string}){
  const [sale,setSale]=useState<Sale|null>(null);const [error,setError]=useState('');const [action,setAction]=useState<'void'|'document'|null>(null);
  const [reason,setReason]=useState('');const [restore,setRestore]=useState(true);const sequence=useRef(0);
  const load=async()=>{const seq=++sequence.current;try{const result=await getSale(id);if(sequence.current===seq)setSale(result);}catch(cause){if(sequence.current===seq)setError(userErrorMessage(cause));}};
  useEffect(()=>{void load();return()=>{sequence.current++;};},[id]);
  if(!sale)return error?<p role="alert" className="text-destructive">{error}</p>:<p>Caricamento vendita…</p>;
  if(sale.status==='draft')return <Button asChild><Link href="/codici/vendite">Riprendi il carrello aperto</Link></Button>;
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{saleLabel(sale)}</h1><p className="text-sm text-muted-foreground">Scontrino interno · {saleDate(sale.closed_at!)} · {sale.operator_name}</p><p className={`mt-1 text-sm font-medium ${sale.status==='void'?'text-destructive':'text-emerald-700 dark:text-emerald-400'}`}>{sale.status==='void'?'Vendita annullata':'Vendita confermata'}</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href="/codici/vendite">Nuova vendita</Link></Button><Button asChild variant="outline"><Link href="/codici/vendite/storico">Storico vendite</Link></Button></div></div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    <section className="rounded-xl border bg-card p-4"><p className="font-semibold">{sale.client_snapshot.name||sale.customer_name||'Cliente al banco'}</p>{sale.client_snapshot.address&&<p className="text-sm">{sale.client_snapshot.address} · {sale.client_snapshot.city}</p>}{sale.payment_method&&<p className="mt-1 text-sm">Pagamento: {sale.payment_method}</p>}{sale.notes&&<p className="mt-2 whitespace-pre-wrap text-sm">{sale.notes}</p>}</section>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['Codice','Articolo','Quantità / ore','Prezzo IVA inclusa','Sconto','Importo'].map(label=><th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{sale.lines.map((line,i)=><tr key={i} className="border-t"><td className="p-3 font-mono">{line.code}</td><td className="min-w-44 p-3">{line.description}</td><td className="whitespace-nowrap p-3">{line.quantity.replace('.',',')} {line.unit}</td><td className="whitespace-nowrap p-3">{money(line.unit_price)}</td><td className="p-3">{line.discount.replace('.',',')}%</td><td className="whitespace-nowrap p-3">{money(line.line_total||'0')}</td></tr>)}</tbody></table></div>
    <p className="text-right text-2xl font-bold">Totale IVA inclusa: {money(sale.total)}</p>
    <PdfActions key={`${sale.id}-${sale.status}`} sale={sale}/>
    <div className="flex flex-wrap gap-2">{sale.delivery_document_id?<Button asChild variant="outline"><Link href={`/codici/ddt/${sale.delivery_document_id}`}>Apri DDT / documento collegato</Link></Button>:sale.status==='closed'&&sale.client_id?<Button variant="outline" onClick={()=>setAction('document')}>Emetti DDT dalla vendita</Button>:null}<Button asChild variant="outline"><Link href="/codici/riordino">Apri lista da riordinare</Link></Button>{sale.status==='closed'&&<Button variant="outline" className="text-destructive" onClick={()=>setAction('void')}>Annulla vendita</Button>}</div>
    {sale.status==='void'&&<div className="rounded-xl bg-destructive/10 p-4 text-sm"><p>Annullata il {saleDate(sale.cancelled_at!)}: {sale.cancellation_reason}</p><p>{sale.stock_restored?'Quantità restituite al magazzino.':'Quantità non restituite al magazzino.'} Le voci da riordinare restano disponibili finché non vengono rimosse manualmente.</p></div>}
    <ConfirmAction open={action==='document'} onOpenChange={v=>{if(!v)setAction(null);}} title="Emettere il documento dalla vendita?" description="Il DDT o documento di lavoro verrà emesso con gli articoli e i prezzi salvati nella vendita. Il magazzino non verrà scaricato nuovamente." label="Conferma emissione DDT" onConfirm={async()=>setSale(await createSaleDdt(sale))}/>
    <ConfirmAction open={action==='void'} onOpenChange={v=>{if(!v)setAction(null);}} title="Annullare la vendita?" description="Lo scontrino interno rimarrà nello storico come annullato. Anche il DDT collegato sarà annullato. La lista da riordinare non verrà svuotata." label="Conferma annullamento vendita" onConfirm={async()=>setSale(await voidSale(sale,reason,restore))}><div className="space-y-3"><label className="text-sm font-medium">Motivo dell’annullamento<Textarea className="mt-1.5" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restore} onChange={e=>setRestore(e.target.checked)}/>Restituisci le quantità al magazzino</label></div></ConfirmAction>
  </div>;
}
