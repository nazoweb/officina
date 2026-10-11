create or replace function public.delivery_validated_lines(p_lines jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; product public.products; qty numeric; price numeric; discount numeric; output jsonb:='[]';
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Aggiungi da 1 a 500 righe al documento.'; end if;
 if jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'Aggiungi da 1 a 500 righe al documento.'; end if;
 for item in select value from jsonb_array_elements(p_lines) loop
  select * into product from public.products where id=(item->>'product_id')::uuid and active;
  if not found then raise exception 'Un prodotto non è più disponibile. Rimuovi la riga o scegli un altro prodotto.'; end if;
  if length(btrim(coalesce(item->>'description',''))) not between 1 and 1000 then raise exception 'Inserisci una descrizione per ogni riga, fino a 1000 caratteri.'; end if;
  if coalesce(item->>'quantity','') !~ '^\d{1,9}(\.\d{1,3})?$' or coalesce(item->>'unit_price','') !~ '^\d{1,10}(\.\d{1,2})?$' or coalesce(item->>'discount','0') !~ '^\d{1,3}(\.\d{1,2})?$' then raise exception 'Controlla quantità, prezzi e sconti. Usa fino a 3 decimali per le quantità e 2 per gli importi.'; end if;
  qty:=(item->>'quantity')::numeric; price:=(item->>'unit_price')::numeric; discount:=coalesce(item->>'discount','0')::numeric;
  if qty<=0 or price<0 or discount<0 or discount>100 then raise exception 'La quantità deve essere maggiore di zero e lo sconto tra 0 e 100.'; end if;
  output:=output||jsonb_build_array(jsonb_build_object('product_id',product.id,'kind',product.kind,'code',product.internal_code,'description',btrim(item->>'description'),'unit',case when product.kind='service' and product.unit='pz' then 'ore' else product.unit end,'quantity',qty::text,'unit_price',price::text,'discount',discount::text,'line_total',round(qty*price*(1-discount/100),2)::text));
 end loop;
 return output;
end; $$;

create or replace function public.save_delivery_document(p_id uuid,p_draft jsonb,p_expected_version integer default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare existing public.delivery_documents; customer public.business_clients; lines jsonb; kind text; total numeric; doc_date date;
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into existing from public.delivery_documents where id=p_id for update;
 if existing.id is not null then
  if existing.status<>'draft' then raise exception 'Il documento è già emesso. Puoi annullarlo, ma non modificarlo.'; end if;
  if p_expected_version is null or p_expected_version<>existing.version then raise exception 'Il documento è cambiato. Riaprilo prima di salvare.'; end if;
 end if;
 select * into customer from public.business_clients where id=(p_draft->>'client_id')::uuid and active;
 if not found then raise exception 'Scegli un’azienda disponibile prima di salvare.'; end if;
 doc_date:=(p_draft->>'document_date')::date;
 if doc_date is null or doc_date<'2000-01-01' or doc_date>'2100-12-31' then raise exception 'Inserisci una data documento valida.'; end if;
 lines:=public.delivery_validated_lines(p_draft->'lines');
 select coalesce(sum((value->>'line_total')::numeric),0) into total from jsonb_array_elements(lines);
 if total>99999999999999.99 then raise exception 'Il totale è troppo grande. Controlla quantità e prezzi.'; end if;
 kind:=case when exists(select 1 from jsonb_array_elements(lines) where value->>'kind'='goods') then 'ddt' else 'work' end;
 if p_draft ? 'vehicle' and jsonb_typeof(p_draft->'vehicle') is distinct from 'object' then raise exception 'Controlla i dati del veicolo e riprova.'; end if;
 if length(coalesce(p_draft->>'delivery_address',''))>300 or length(coalesce(p_draft->>'transport_reason',''))>240 or length(coalesce(p_draft->>'carrier',''))>240 or length(coalesce(p_draft->>'notes',''))>2000 or exists(select 1 from jsonb_each_text(coalesce(p_draft->'vehicle','{}')) where length(value)>120) then raise exception 'Uno dei testi è troppo lungo. Riduci indirizzi, note o dati del veicolo.'; end if;
 if octet_length(p_draft::text)>1000000 then raise exception 'Il documento contiene troppi dati. Riduci le descrizioni.'; end if;
 if coalesce(p_draft->'vehicle'->>'kilometres','')<>'' and (p_draft->'vehicle'->>'kilometres')!~ '^\d{1,9}$' then raise exception 'Inserisci chilometri interi, a partire da zero.'; end if;
 insert into public.delivery_documents(id,client_id,kind,document_date,client_snapshot,vehicle,delivery_address,transport_reason,carrier,transport_at,packages,notes,lines,total)
 values(p_id,customer.id,kind,doc_date,to_jsonb(customer)-'updated_at',coalesce(p_draft->'vehicle','{}'),coalesce(p_draft->>'delivery_address',''),coalesce(p_draft->>'transport_reason',''),coalesce(p_draft->>'carrier',''),nullif(p_draft->>'transport_at','')::timestamptz,nullif(p_draft->>'packages','')::integer,coalesce(p_draft->>'notes',''),lines,total)
 on conflict(id) do update set client_id=excluded.client_id,kind=excluded.kind,document_date=excluded.document_date,client_snapshot=excluded.client_snapshot,vehicle=excluded.vehicle,delivery_address=excluded.delivery_address,transport_reason=excluded.transport_reason,carrier=excluded.carrier,transport_at=excluded.transport_at,packages=excluded.packages,notes=excluded.notes,lines=excluded.lines,total=excluded.total,version=delivery_documents.version+1,updated_at=now();
 return p_id;
end; $$;


notify pgrst,'reload schema';
