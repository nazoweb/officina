"use client";
import { useEffect, useRef, useState } from 'react';
import { PartyFields } from './PartyFields';
import { getDeliverySettings, saveDeliverySettings } from '@/lib/ddt/api';
import type { DeliverySettings } from '@/types/ddt';
import { userErrorMessage } from '@/lib/user-errors';
import { Button } from '@/components/ui/button';
export function DocumentSettings() {
 const [settings,setSettings]=useState<DeliverySettings|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const pending=useRef(false);
 useEffect(()=>{getDeliverySettings().then(setSettings).catch(cause=>setError(userErrorMessage(cause)));},[]);
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(!settings||pending.current)return;pending.current=true;setBusy(true);setError('');setNotice('');try{await saveDeliverySettings(settings);setSettings(await getDeliverySettings());setNotice('Impostazioni salvate.');}catch(cause){setError(userErrorMessage(cause));}finally{pending.current=false;setBusy(false);}};
 return <div className="space-y-4">{error&&<p role="alert" className="text-destructive">{error}</p>}{settings?<form onSubmit={save} className="space-y-5"><p className="text-sm text-muted-foreground">Questi dati compariranno nell’intestazione dei nuovi documenti. I documenti già emessi mantengono i dati originali.</p><fieldset disabled={busy} className="space-y-5"><PartyFields party={settings} onChange={party=>setSettings({...settings,...party,fiscal_verified:false})}/><div className="rounded-xl border p-4"><h2 className="font-semibold">Verifica amministrativa</h2><p className="mt-2 text-sm text-muted-foreground">Conferma con il referente amministrativo o commercialista dati fiscali, modalità di trasporto, uso dei documenti per sole prestazioni e conservazione. I prezzi sono già IVA inclusa: il sito non aggiunge un’aliquota IVA.</p><label className="mt-3 flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={settings.fiscal_verified} onChange={event=>setSettings({...settings,fiscal_verified:event.target.checked})}/>Dati e modalità d’uso verificati con il referente amministrativo</label></div></fieldset>{notice&&<p role="status" className="text-sm">{notice}</p>}<Button disabled={busy}>{busy?'Salvataggio…':'Salva impostazioni'}</Button></form>:!error&&<p>Caricamento impostazioni…</p>}</div>;
}
