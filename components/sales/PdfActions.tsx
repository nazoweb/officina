"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { userErrorMessage } from '@/lib/user-errors';
import type { Sale, ReorderPrint } from '@/types/sales';

export function PdfActions({sale,snapshot}:{sale?:Sale;snapshot?:ReorderPrint}) {
  const pending=useRef(false); const objectUrl=useRef<string|null>(null);
  const [preview,setPreview]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);},[]);
  const generate=async(download:boolean)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try{
      const [{createReceiptPdf,createReorderPdf},response]=await Promise.all([import('@/lib/sales/pdf'),fetch('/fonts/NotoSans-Regular.ttf')]);
      if(!response.ok)throw new Error('PDF font unavailable');
      const assets={font:new Uint8Array(await response.arrayBuffer())};
      const bytes=sale?await createReceiptPdf(sale,assets):await createReorderPdf(snapshot!,assets);
      if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type:'application/pdf'}));objectUrl.current=url;
      if(download){const a=document.createElement('a');a.href=url;a.download=sale?`vendita-${sale.number}-${sale.year}.pdf`:`riordino-stampa-${snapshot!.print_number}.pdf`;a.click();}
      else setPreview(url);
    }catch(cause){setError(userErrorMessage(cause,'Impossibile preparare il PDF. Riprova: i dati sono già salvati nello storico.'));}
    finally{pending.current=false;setBusy(false);}
  };
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button className="h-11" variant="outline" disabled={busy} onClick={()=>generate(false)}>Stampa</Button><Button className="h-11" variant="outline" disabled={busy} onClick={()=>generate(true)}>{busy?'Preparazione…':'Scarica PDF'}</Button></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{preview&&<div className="space-y-2"><a className="text-sm underline" href={preview} target="_blank" rel="noreferrer">Apri il PDF per stampare</a><iframe title="Anteprima stampa" src={preview} className="h-[70vh] w-full rounded-lg border"/></div>}</div>;
}
