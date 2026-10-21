"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmAction } from '@/components/inventory/ConfirmAction';
import { listClients } from '@/lib/ddt/api';
import { findProductsByCode, searchProducts } from '@/lib/inventory/api';
import { addSaleProduct, closeSale, discardSale, editSale, getSale, openSale, updateSaleLine } from '@/lib/sales/api';
import { decimalInput, money } from '@/lib/ddt/money';
import { userErrorMessage, UserFacingError } from '@/lib/user-errors';
import type { BusinessClient } from '@/types/ddt';
import type { Product } from '@/types/inventory';
import type { Sale } from '@/types/sales';

type Header = Pick<Sale,'client_id'|'customer_name'|'notes'|'payment_method'>;
type LineDraft = { quantity:string; unit_price:string; discount:string };
export function SaleCart(){
  const router=useRouter();const current=useRef<Sale|null>(null);const pending=useRef(false);const awaitingChoice=useRef(false);
  const queue=useRef<Array<{code?:string;productId?:string;operationId:string}>>([]);const scanner=useRef<HTMLInputElement>(null);
  const [sale,setSale]=useState<Sale|null>(null);const [clients,setClients]=useState<BusinessClient[]>([]);
  const [header,setHeader]=useState<Header>({client_id:null,customer_name:'',notes:'',payment_method:''});
  const [lineDrafts,setLineDrafts]=useState<Record<string,LineDraft>>({});
  const [code,setCode]=useState('');const [matches,setMatches]=useState<Product[]>([]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [action,setAction]=useState<'close'|'ddt'|'discard'|null>(null);
  const apply=(next:Sale)=>{current.current=next;setSale(next);};
  const setFromSale=(next:Sale)=>{apply(next);setHeader({client_id:next.client_id,customer_name:next.customer_name,notes:next.notes,payment_method:next.payment_method});};
  const load=async()=>{
    setError('');setBusy(true);
    try{const [next,companies]=await Promise.all([openSale(),listClients()]);setFromSale(next);setClients(companies.filter(c=>c.active));}
    catch(cause){setError(userErrorMessage(cause));}finally{setBusy(false);}
  };
  useEffect(()=>{void load();},[]);
  const dirtyLines=Object.keys(lineDrafts).length>0;
  const processQueue=async()=>{
    if(pending.current||!current.current||awaitingChoice.current)return;
    pending.current=true;setBusy(true);setError('');setNotice('');const problems:string[]=[];let added=0;
    try{
      while(queue.current.length){
        const job=queue.current.shift()!;
        try{
          let productId=job.productId;
          if(!productId){
            let found=await findProductsByCode(job.code!);
            // Full internal codes remain usable even when an older product has no identifier row.
            if(!found.length){const all=await searchProducts(job.code!);found=all.filter(p=>p.internal_code.toUpperCase()===job.code!.trim().toUpperCase());if(!found.length){if(all.length){setMatches(all);awaitingChoice.current=true;problems.push('Scegli il prodotto dai risultati. Le scansioni successive restano in attesa.');break;}problems.push('Nessun prodotto trovato per questo codice.');continue;}}
            if(found.length!==1){setMatches(found);awaitingChoice.current=true;problems.push('Questo codice corrisponde a più prodotti. Scegli quello corretto; le altre scansioni restano in attesa.');break;}
            productId=found[0].id;
          }
          // Keep the same key if a lost response requires a retry; a new scan always has a new key.
          let next:Sale;
          try{next=await addSaleProduct(current.current!.id,productId,job.operationId);}
          catch(cause){
            const latest=await getSale(current.current!.id);apply(latest);
            if(latest.status!=='draft')throw cause;
            next=await addSaleProduct(latest.id,productId,job.operationId);
          }
          apply(next);added++;setMatches([]);
        }catch(cause){problems.push(userErrorMessage(cause));}
      }
      if(added)setNotice(`${added} ${added===1?'articolo aggiunto':'articoli aggiunti'} al carrello.`);
      setError(problems.join(' '));
    }finally{pending.current=false;setBusy(false);scanner.current?.focus();}
  };
  const enqueue=(job:{code?:string;productId?:string})=>{
    if(dirtyLines){setError('Salva le righe modificate prima di aggiungere altri articoli.');return;}
    const next={...job,operationId:crypto.randomUUID()};
    if(awaitingChoice.current&&job.productId){queue.current.unshift(next);awaitingChoice.current=false;setMatches([]);}else queue.current.push(next);
    setCode('');if(awaitingChoice.current)setNotice(`${queue.current.length} scansioni in attesa della scelta.`);void processQueue();
  };
  const mutate=async(operation:()=>Promise<Sale>)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{apply(await operation());}catch(cause){setError(userErrorMessage(cause));if(current.current)try{apply(await getSale(current.current.id));}catch{/* Keep the current cart visible. */}}
    finally{pending.current=false;setBusy(false);if(queue.current.length)void processQueue();}
  };
  const saveLine=async(index:number,key:string,remove=false)=>{
    const s=current.current!;const value=remove?s.lines[index]:(lineDrafts[key]??s.lines[index]);
    const quantity=remove?'0':decimalInput(value.quantity,3,'Quantità');
    const next=await updateSaleLine(s,index,quantity,decimalInput(value.unit_price,2,'Prezzo'),decimalInput(value.discount||'0',2,'Sconto'));
    setLineDrafts(drafts=>{const copy={...drafts};delete copy[key];return copy;});return next;
  };
  const finish=async()=>{
    if(pending.current||dirtyLines||awaitingChoice.current||queue.current.length)throw new UserFacingError('Salva le righe modificate prima di chiudere la vendita.');
    pending.current=true;setBusy(true);
    try{
      const saved=await editSale(current.current!,header);apply(saved);
      const closed=await closeSale(saved,action==='ddt');apply(closed);
      router.push(`/codici/vendite/${closed.id}`);
    }catch(cause){
      try{const latest=await getSale(current.current!.id);apply(latest);if(latest.status!=='draft'){router.push(`/codici/vendite/${latest.id}`);return;}}catch{/* The original error remains useful. */}
      throw cause;
    }finally{pending.current=false;setBusy(false);}
  };
  if(!sale)return <div className="space-y-3">{error?<><p role="alert" className="text-destructive">{error}</p><Button onClick={load}>Riprova</Button></>:<p>Apertura carrello…</p>}</div>;
  if(sale.status!=='draft')return <div className="space-y-3"><p>Vendita chiusa e salvata nello storico.</p><Button asChild><Link href={`/codici/vendite/${sale.id}`}>Apri lo scontrino interno</Link></Button></div>;
  const headerDirty=JSON.stringify(header)!==JSON.stringify({client_id:sale.client_id,customer_name:sale.customer_name,notes:sale.notes,payment_method:sale.payment_method});
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/codici/vendite/storico">Storico vendite</Link></Button><Button asChild variant="outline"><Link href="/codici/riordino">Da riordinare</Link></Button></div>
    <p className="text-sm text-muted-foreground">Carrello personale salvato automaticamente per gli articoli. Il magazzino viene scaricato alla chiusura, quando i ricambi entrano anche nella lista da riordinare.</p>
    {error&&<p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {notice&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
    <form className="rounded-xl border bg-card p-4" onSubmit={e=>{e.preventDefault();if(code.trim())enqueue({code:code.trim()});}}>
      <label className="block text-sm font-medium">Scansiona o digita il codice<div className="mt-2 flex gap-2"><Input ref={scanner} value={code} onChange={e=>setCode(e.target.value)} placeholder="Codice o barcode della vendita…" className="h-12 font-mono" autoFocus disabled={Boolean(action)}/><Button className="h-12" disabled={!code.trim()||Boolean(action)}>Aggiungi</Button></div></label>
      <p className="mt-2 text-xs text-muted-foreground">Ogni scansione aggiunge un pezzo. Con un codice parziale potrai scegliere il prodotto dai risultati.</p>
    </form>
    {matches.length>0&&<section className="space-y-2 rounded-xl border p-4"><h2 className="font-semibold">Scegli il prodotto</h2><p className="text-xs text-muted-foreground">Le scansioni successive sono conservate in attesa della scelta.</p><Button variant="outline" disabled={busy} onClick={()=>{setMatches([]);awaitingChoice.current=false;void processQueue();}}>Ignora questo codice</Button>{matches.map(p=><Button key={p.id} variant="outline" className="h-auto w-full justify-start whitespace-normal py-3 text-left" disabled={busy||dirtyLines} onClick={()=>enqueue({productId:p.id})}>{p.internal_code} · {p.name||p.description}</Button>)}</section>}
    <fieldset disabled={busy||Boolean(action)} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Azienda per il DDT<select aria-label="Azienda per il DDT" className="mt-1.5 h-10 w-full rounded-md border bg-background px-3" value={header.client_id??''} onChange={e=>{const company=clients.find(c=>c.id===e.target.value);setHeader({...header,client_id:company?.id??null,customer_name:company?.name??header.customer_name});}}><option value="">Cliente al banco / nessuna azienda</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-medium">Nome cliente (facoltativo)<Input className="mt-1.5" maxLength={160} value={header.customer_name} disabled={Boolean(header.client_id)} onChange={e=>setHeader({...header,customer_name:e.target.value})}/></label>
      <label className="text-sm font-medium">Pagamento<select aria-label="Pagamento" className="mt-1.5 h-10 w-full rounded-md border bg-background px-3" value={header.payment_method} onChange={e=>setHeader({...header,payment_method:e.target.value})}>{['','Contanti','Carta','Bonifico','Altro'].map(v=><option key={v} value={v}>{v||'Non indicato'}</option>)}</select></label>
      <label className="text-sm font-medium">Note vendita<Textarea className="mt-1.5" maxLength={2000} value={header.notes} onChange={e=>setHeader({...header,notes:e.target.value})}/></label>
      <div className="sm:col-span-2"><Button variant="outline" disabled={!headerDirty} onClick={()=>mutate(()=>editSale(current.current!,header))}>Salva dati cliente</Button>{headerDirty&&<span className="ml-2 text-xs text-muted-foreground">Questi dati saranno salvati anche alla chiusura.</span>}</div>
    </fieldset>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Articoli della vendita ({sale.lines.length})</h2>
      {sale.lines.map((line,index)=>{const draft=lineDrafts[line.product_id]??line;const change=(key:keyof LineDraft,value:string)=>setLineDrafts(all=>({...all,[line.product_id]:{quantity:draft.quantity,unit_price:draft.unit_price,discount:draft.discount,[key]:value}}));return <form key={line.product_id} className="space-y-3 rounded-xl border bg-card p-4" onSubmit={e=>{e.preventDefault();void mutate(()=>saveLine(index,line.product_id));}}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{line.code} · {line.kind==='service'?'Prestazione':'Ricambio'}</p><h3 className="font-semibold">{line.description}</h3></div><Button type="button" variant="outline" size="sm" disabled={busy||Boolean(action)} aria-label={`Rimuovi ${line.code} dalla vendita`} onClick={()=>mutate(()=>saveLine(index,line.product_id,true))}>Rimuovi</Button></div><fieldset disabled={busy||Boolean(action)} className="grid items-end gap-3 sm:grid-cols-4"><label className="text-sm">Quantità / ore ({line.unit})<Input aria-label={`Quantità vendita ${line.code}`} className="mt-1" inputMode="decimal" value={draft.quantity} onChange={e=>change('quantity',e.target.value)}/></label><label className="text-sm">Prezzo IVA inclusa<Input aria-label={`Prezzo vendita ${line.code}`} className="mt-1" inputMode="decimal" value={draft.unit_price} onChange={e=>change('unit_price',e.target.value)}/></label><label className="text-sm">Sconto (%)<Input aria-label={`Sconto vendita ${line.code}`} className="mt-1" inputMode="decimal" value={draft.discount} onChange={e=>change('discount',e.target.value)}/></label><div><p className="mb-1 text-right font-semibold">{money(line.line_total||'0')}</p><Button variant="outline" className="w-full" disabled={!lineDrafts[line.product_id]}>Salva riga</Button></div></fieldset></form>;})}
      {sale.lines.length===0&&<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Il carrello è vuoto. Scansiona il primo articolo.</p>}
    </section>
    {dirtyLines&&<p role="status" className="text-sm text-amber-700 dark:text-amber-400">Salva le righe modificate prima di aggiungere articoli o chiudere la vendita.</p>}
    <div className="rounded-xl border bg-card p-5"><p className="text-right text-sm text-muted-foreground">Totale IVA inclusa</p><p className="text-right text-3xl font-bold tabular-nums">{money(sale.total)}</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy||dirtyLines||matches.length>0||!sale.lines.length} onClick={()=>setAction('close')}>Chiudi vendita</Button><Button variant="outline" disabled={busy||dirtyLines||matches.length>0||!sale.lines.length||!header.client_id} onClick={()=>setAction('ddt')}>Chiudi ed emetti DDT</Button><Button variant="outline" disabled={busy} onClick={()=>setAction('discard')}>Abbandona carrello</Button></div><p className="mt-3 text-xs text-muted-foreground">Per emettere il DDT scegli un’azienda con dati completi. Alla chiusura lo scontrino interno resta nello storico e puoi aprire una nuova vendita.</p></div>
    <ConfirmAction open={action==='close'||action==='ddt'} onOpenChange={v=>{if(!v)setAction(null);}} title={action==='ddt'?'Chiudere la vendita ed emettere il DDT?':'Chiudere la vendita?'} description={`Totale ${money(sale.total)}. La vendita verrà salvata nello storico, i ricambi saranno scaricati dal magazzino e aggiunti alla lista da riordinare.`} label={action==='ddt'?'Conferma vendita e DDT':'Conferma vendita'} onConfirm={finish}>{sale.lines.some(l=>Number(l.unit_price)===0)&&<p className="text-sm text-amber-700">Ci sono articoli con prezzo zero. Controlla che siano corretti prima di confermare.</p>}</ConfirmAction>
    <ConfirmAction open={action==='discard'} onOpenChange={v=>{if(!v)setAction(null);}} title="Abbandonare questo carrello?" description="Gli articoli del carrello verranno rimossi. Il magazzino e la lista da riordinare non saranno modificati." label="Abbandona carrello" onConfirm={async()=>{await discardSale(current.current!);queue.current=[];awaitingChoice.current=false;setLineDrafts({});setMatches([]);await load();}}/>
  </div>;
}
