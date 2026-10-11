"use client";
import { Input } from '@/components/ui/input';
import type { Party } from '@/types/ddt';
export function PartyFields({ party, onChange }: { party: Party; onChange: (party: Party) => void }) {
 const fields: Array<[keyof Party,string,number]> = [['name','Ragione sociale',160],['vat_number','Partita IVA',35],['tax_code','Codice fiscale',35],['address','Indirizzo',240],['postcode','CAP',20],['city','Comune',160],['province','Provincia',40],['country','Paese',80],['email','Email',254],['phone','Telefono',40]];
 return <div className="grid gap-4 sm:grid-cols-2">{fields.map(([field,label,length]) => <label className="block text-sm font-medium" key={field}>{label}<Input className="mt-1.5" value={party[field]} maxLength={length} type={field==='email'?'email':'text'} required={field==='name'} onChange={event => onChange({...party,[field]:event.target.value})} /></label>)}</div>;
}
