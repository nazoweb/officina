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
import { normalizeScannerInput } from '@/lib/inventory/scanner';
import { addSaleProduct, closeSale, discardSale, editSale, getSale, openSale, updateSaleLine } from '@/lib/sales/api';
import { useUnsavedChanges } from '@/hooks/use-workspace-navigation';
import { NewClientDialog } from '@/components/ddt/NewClientDialog';
import { prepareCartLines, saveCartLines, type SaleLineDraft } from '@/lib/sales/cart-drafts';
import { money, centsDecimal, lineCents } from '@/lib/ddt/money';
import { userErrorMessage, UserFacingError } from '@/lib/user-errors';
import type { BusinessClient } from '@/types/ddt';
import type { Product } from '@/types/inventory';
import type { Sale } from '@/types/sales';

type Header = Pick<Sale,'client_id'|'customer_name'|'notes'|'payment_method'>;
type LineDraft = SaleLineDraft;
export function SaleCart(){
  const router=useRouter();const current=useRef<Sale|null>(null);const pending=useRef(false);const awaitingChoice=useRef(false);
  const queue=useRef<Array<{code?:string;productId?:string;operationId:string}>>([]);const scanner=useRef<HTMLInputElement>(null);
  const [sale,setSale]=useState<Sale|null>(null);const [clients,setClients]=useState<BusinessClient[]>([]);
  const [header,setHeader]=useState<Header>({client_id:null,customer_name:'',notes:'',payment_method:''});
  const [lineDrafts,setLineDrafts]=useState<Record<string,LineDraft>>({});
  const [code,setCode]=useState('');const [matches,setMatches]=useState<Product[]>([]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const draftsRef=useRef(lineDrafts);draftsRef.current=lineDrafts;
  const headerRef=useRef(header);headerRef.current=header;
  const headerDirty=Boolean(sale)&&JSON.stringify(header)!==JSON.stringify({client_id:sale?.client_id,customer_name:sale?.customer_name,notes:sale?.notes,payment_method:sale?.payment_method});
  const markSaved=useUnsavedChanges(Object.keys(lineDrafts).length>0||headerDirty);
  const [action,setAction]=useState<'close'|'ddt'|'discard'|null>(null);
  const apply=(next:Sale)=>{current.current=next;setSale(next);};
  const setFromSale=(next:Sale)=>{apply(next);const values={client_id:next.client_id,customer_name:next.customer_name,notes:next.notes,payment_method:next.payment_method};headerRef.current=values;setHeader(values);};
  const load=async()=>{
    setError('');setBusy(true);
    try{const [next,companies]=await Promise.all([openSale(),listClients()]);setFromSale(next);setClients(companies.filter(c=>c.active));}
    catch(cause){setError(userErrorMessage(cause));}finally{setBusy(false);}
  };
  useEffect(()=>{void load();},[]);
  const dirtyLines=Object.keys(lineDrafts).length>0;
  const saveDrafts=async()=>{
    if(!current.current)throw new UserFacingError('Il carrello non è disponibile.');
    const next=await saveCartLines(current.current,{...draftsRef.current},updateSaleLine,(saved,key)=>{
      apply(saved);const remaining={...draftsRef.current};delete remaining[key];draftsRef.current=remaining;setLineDrafts(remaining);
    });
    const values=headerRef.current;
    if(JSON.stringify(values)!==JSON.stringify({client_id:next.client_id,customer_name:next.customer_name,notes:next.notes,payment_method:next.payment_method})){
      const saved=await editSale(next,values);setFromSale(saved);return saved;
    }
    return next;
  };
  const processQueue=async()=>{
    if(pending.current||!current.current||awaitingChoice.current)return;
    pending.current=true;setBusy(true);setError('');setNotice('');const problems:string[]=[];let added=0;
    try{
      await saveDrafts();
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
    }catch(cause){setError(userErrorMessage(cause));setNotice(`${queue.current.length} articoli in attesa: correggi i dati e premi Salva carrello per continuare.`);}
    finally{pending.current=false;setBusy(false);scanner.current?.focus();}
  };
  const enqueue=(job:{code?:string;productId?:string})=>{
    const next={...job,operationId:crypto.randomUUID()};
    if(awaitingChoice.current&&job.productId){queue.current.unshift(next);awaitingChoice.current=false;setMatches([]);}else queue.current.push(next);
    setCode('');if(awaitingChoice.current)setNotice(`${queue.current.length} scansioni in attesa della scelta.`);void processQueue();
  };
  const mutate=async(operation:()=>Promise<Sale>)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{apply(await operation());}catch(cause){setError(userErrorMessage(cause));if(current.current)try{apply(await getSale(current.current.id));}catch{/* Keep the current cart visible. */}}
    finally{pending.current=false;setBusy(false);if(queue.current.length)void processQueue();}
  };
  const removeLine=async(key:string)=>{
    const removedDraft=draftsRef.current[key];
    const remaining={...draftsRef.current};delete remaining[key];draftsRef.current=remaining;setLineDrafts(remaining);
    try {
      const saved=await saveDrafts();const index=saved.lines.findIndex(line=>line.product_id===key);
      if(index<0)throw new UserFacingError('L’articolo non è più nel carrello.');
      const line=saved.lines[index];return await updateSaleLine(saved,index,'0',line.unit_price,line.discount);
    } catch(cause) {
      if(removedDraft){draftsRef.current={...draftsRef.current,[key]:removedDraft};setLineDrafts(draftsRef.current);}
      throw cause;
    }
  };
  const finish=async()=>{
    if(pending.current||awaitingChoice.current||queue.current.length)throw new UserFacingError('Attendi l’aggiunta degli articoli e risolvi le scansioni in attesa prima di chiudere.');
    pending.current=true;setBusy(true);
    try{
      const saved=await saveDrafts();apply(saved);
      const closed=await closeSale(saved,action==='ddt');apply(closed);
      markSaved();router.push(`/codici/vendite/${closed.id}`);
    }catch(cause){
      try{const latest=await getSale(current.current!.id);apply(latest);if(latest.status!=='draft'){markSaved();router.push(`/codici/vendite/${latest.id}`);return;}}catch{/* The original error remains useful. */}
      throw cause;
    }finally{pending.current=false;setBusy(false);}
  };
  if(!sale)return <div className="space-y-3">{error?<><p role="alert" className="text-destructive">{error}</p><Button onClick={load}>Riprova</Button></>:<p>Apertura carrello…</p>}</div>;
  if(sale.status!=='draft')return <div className="space-y-3"><p>Vendita chiusa e salvata nello storico.</p><Button asChild><Link href={`/codici/vendite/${sale.id}`}>Apri lo scontrino interno</Link></Button></div>;
  let previewLines=sale.lines;let previewError='';
  try{previewLines=prepareCartLines(sale,lineDrafts);}catch(cause){previewError=userErrorMessage(cause);}
  const previewTotal=previewError?null:centsDecimal(previewLines.reduce((total,line)=>total+lineCents(line.quantity,line.unit_price,line.discount),0n));
  const dirty=dirtyLines||headerDirty;
  return <div className="space-y-5 pb-24 xl:pb-0">
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/codici/vendite/storico">Storico vendite</Link></Button><Button asChild variant="outline"><Link href="/codici/riordino">Da riordinare</Link></Button></div>
    {error&&<p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {notice&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
    <div className="space-y-3"><h2 className="text-lg font-semibold">Articoli ({sale.lines.length})</h2>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"><div className="min-w-0 space-y-5">
        <form className="rounded-xl border bg-card p-4" onSubmit={e=>{e.preventDefault();const scanned=normalizeScannerInput(code).trim();if(scanned)enqueue({code:scanned});}}>
      <label htmlFor="sale-code" className="block text-sm font-medium">Aggiungi un articolo</label><div className="mt-2 flex gap-2"><Input id="sale-code" ref={scanner} value={code} onChange={e=>setCode(normalizeScannerInput(e.target.value))} placeholder="Codice o barcode…" className="h-12 font-mono" autoFocus disabled={Boolean(action)}/><Button className="h-12" disabled={!code.trim()||Boolean(action)}>Aggiungi</Button></div>
      <p className="mt-2 text-xs text-muted-foreground">Ogni scansione aggiunge un pezzo e salva il carrello.</p>
    </form>
    {matches.length>0&&<section className="space-y-2 rounded-xl border p-4"><h2 className="font-semibold">Scegli il prodotto</h2><p className="text-xs text-muted-foreground">Le scansioni successive sono conservate in attesa della scelta.</p><Button variant="outline" disabled={busy} onClick={()=>{setMatches([]);awaitingChoice.current=false;void processQueue();}}>Ignora questo codice</Button>{matches.map(p=><Button key={p.id} variant="outline" className="h-auto w-full justify-start whitespace-normal py-3 text-left" disabled={busy} onClick={()=>enqueue({productId:p.id})}>{p.internal_code} · {p.name||p.description}</Button>)}</section>}
<section className="space-y-3">
      {sale.lines.map((line,index)=>{const draft=lineDrafts[line.product_id]??line;const change=(key:keyof LineDraft,value:string)=>setLineDrafts(all=>({...all,[line.product_id]:{quantity:draft.quantity,unit_price:draft.unit_price,discount:draft.discount,[key]:value}}));return <article key={line.product_id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-mono text-xs text-muted-foreground">{line.code} · {line.kind==='service'?'Prestazione':'Ricambio'}</p><h3 className="break-words font-semibold">{line.description}</h3></div><p className="shrink-0 font-semibold tabular-nums">{previewError&&lineDrafts[line.product_id]?'Valori da completare':money(previewLines[index].line_total||'0')}</p></div><fieldset disabled={busy||Boolean(action)} className="grid grid-cols-3 gap-3"><label className="min-w-0 text-sm">Quantità ({line.unit})<Input aria-label={`Quantità vendita ${line.code}`} className="mt-1 h-11" inputMode="decimal" value={draft.quantity} onChange={e=>change('quantity',e.target.value)}/></label><label className="min-w-0 text-sm">Prezzo €<Input aria-label={`Prezzo vendita ${line.code}`} className="mt-1 h-11" inputMode="decimal" value={draft.unit_price} onChange={e=>change('unit_price',e.target.value)}/></label><label className="min-w-0 text-sm">Sconto %<Input aria-label={`Sconto vendita ${line.code}`} className="mt-1 h-11" inputMode="decimal" value={draft.discount} onChange={e=>change('discount',e.target.value)}/></label></fieldset><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="min-h-10" disabled={busy||Boolean(action)} aria-label={`Rimuovi ${line.code} dalla vendita`} onClick={()=>mutate(()=>removeLine(line.product_id))}>Rimuovi</Button></div></article>;})}
      {sale.lines.length===0&&<p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Il carrello è vuoto. Scansiona il primo articolo.</p>}
    </section>

    </div>
    <aside className="space-y-4 rounded-xl border bg-card p-5 xl:sticky xl:top-5 xl:max-h-[calc(100dvh-2.5rem)] xl:overflow-y-auto"><div><p className="text-sm text-muted-foreground">Totale IVA inclusa</p><p className="mt-1 text-3xl font-bold tabular-nums">{previewTotal===null?'Da completare':money(previewTotal)}</p></div>    <p role="status" className="text-xs text-muted-foreground">{busy?'Salvataggio in corso…':dirty?'Modifiche da salvare. Si salvano anche aggiungendo un articolo o confermando la vendita.':'Carrello salvato.'}</p>
    {previewError&&<p role="alert" className="text-sm text-destructive">{previewError}</p>}
<div className="grid gap-2"><Button variant="outline" className="h-11" disabled={busy||Boolean(action)||(!dirty&&!queue.current.length)||Boolean(previewError)} onClick={()=>mutate(saveDrafts)}>Salva carrello</Button><Button className="h-11" disabled={busy||matches.length>0||queue.current.length>0||Boolean(previewError)||!sale.lines.length} onClick={()=>setAction('close')}>Chiudi vendita</Button><Button className="h-11" variant="outline" disabled={busy||matches.length>0||queue.current.length>0||Boolean(previewError)||!sale.lines.length||!header.client_id} onClick={()=>setAction('ddt')}>Chiudi ed emetti DDT</Button></div><fieldset disabled={busy||Boolean(action)} className="grid gap-3">
      <label className="text-sm font-medium">Azienda per il DDT<select aria-label="Azienda per il DDT" className="mt-1.5 h-11 w-full rounded-md border bg-background px-3" value={header.client_id??''} onChange={e=>{const company=clients.find(c=>c.id===e.target.value);setHeader({...header,client_id:company?.id??null,customer_name:company?.name??header.customer_name});}}><option value="">Cliente al banco / nessuna azienda</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-medium">Nome cliente (facoltativo)<Input className="mt-1.5 h-11" maxLength={160} value={header.customer_name} disabled={Boolean(header.client_id)} onChange={e=>setHeader({...header,customer_name:e.target.value})}/></label>
      <label className="text-sm font-medium">Pagamento<select aria-label="Pagamento" className="mt-1.5 h-11 w-full rounded-md border bg-background px-3" value={header.payment_method} onChange={e=>setHeader({...header,payment_method:e.target.value})}>{['','Contanti','Carta','Bonifico','Altro'].map(v=><option key={v} value={v}>{v||'Non indicato'}</option>)}</select></label>
      <details><summary className="cursor-pointer text-sm font-medium">Note vendita (facoltative)</summary><label className="sr-only" htmlFor="sale-notes">Note vendita</label><Textarea id="sale-notes" className="mt-1.5 h-11" maxLength={2000} value={header.notes} onChange={e=>setHeader({...header,notes:e.target.value})}/></details>

    </fieldset>
<NewClientDialog disabled={busy||Boolean(action)} onCreated={client=>{setClients(all=>[...all,client]);setHeader(values=>({...values,client_id:client.id,customer_name:client.name}));}}/>

<p className="text-xs text-muted-foreground">Alla chiusura aggiorni magazzino e riordino. Lo scontrino resta nello storico.{!header.client_id&&<> Per il DDT scegli un’azienda qui sopra.</>}</p><div className="border-t pt-3"><Button variant="ghost" className="h-11 w-full text-muted-foreground" disabled={busy} onClick={()=>setAction('discard')}>Abbandona carrello</Button></div></aside></div></div>
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm xl:hidden"><div className="min-w-0"><p className="text-xs text-muted-foreground">Totale IVA inclusa</p><p className="font-semibold">{previewTotal===null?'Completa i valori':money(previewTotal)}</p></div><Button disabled={busy||Boolean(action)||matches.length>0||queue.current.length>0||Boolean(previewError)||!sale.lines.length} onClick={()=>setAction('close')}>Chiudi vendita</Button></div>
    <ConfirmAction open={action==='close'||action==='ddt'} onOpenChange={v=>{if(!v)setAction(null);}} title={action==='ddt'?'Chiudere la vendita ed emettere il DDT?':'Chiudere la vendita?'} description={`Totale ${previewTotal===null?'Da completare':money(previewTotal)}. La vendita verrà salvata nello storico, i ricambi saranno scaricati dal magazzino e aggiunti alla lista da riordinare.`} label={action==='ddt'?'Conferma vendita e DDT':'Conferma vendita'} onConfirm={finish}>{previewLines.some(l=>Number(l.unit_price)===0)&&<p className="text-sm text-amber-700">Ci sono articoli con prezzo zero. Controlla che siano corretti prima di confermare.</p>}</ConfirmAction>
    <ConfirmAction open={action==='discard'} onOpenChange={v=>{if(!v)setAction(null);}} title="Abbandonare questo carrello?" description="Gli articoli del carrello verranno rimossi. Il magazzino e la lista da riordinare non saranno modificati." label="Abbandona carrello" onConfirm={async()=>{await discardSale(current.current!);queue.current=[];awaitingChoice.current=false;draftsRef.current={};setLineDrafts({});setMatches([]);await load();}}/>
  </div>;
}
