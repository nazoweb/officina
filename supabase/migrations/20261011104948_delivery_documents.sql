create or replace function public.touch_delivery_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
alter table public.products add column kind text not null default 'goods' check(kind in ('goods','service'));

create table public.business_clients (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 160),
 vat_number text not null default '', tax_code text not null default '', address text not null default '', postcode text not null default '', city text not null default '', province text not null default '', country text not null default 'Italia', email text not null default '', phone text not null default '', delivery_address text not null default '', active boolean not null default true,
 updated_at timestamptz not null default now()
);
create unique index business_clients_vat_unique on public.business_clients(upper(regexp_replace(vat_number,'\s','','g'))) where btrim(vat_number)<>'';
create unique index business_clients_tax_unique on public.business_clients(upper(regexp_replace(tax_code,'\s','','g'))) where btrim(tax_code)<>'';
create trigger business_clients_touch before update on public.business_clients for each row execute function public.touch_delivery_updated_at();

create table public.delivery_settings (
 id boolean primary key default true check(id), name text not null default '', vat_number text not null default '', tax_code text not null default '', address text not null default '', postcode text not null default '', city text not null default '', province text not null default '', country text not null default 'Italia', email text not null default '', phone text not null default '', fiscal_verified boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.delivery_settings(id) values(true);
create trigger delivery_settings_touch before update on public.delivery_settings for each row execute function public.touch_delivery_updated_at();

create table public.delivery_documents (
 id uuid primary key, client_id uuid references public.business_clients(id) on delete set null,
 kind text not null check(kind in ('ddt','work')), status text not null default 'draft' check(status in ('draft','issued','void')),
 number integer, year integer, document_date date not null, client_snapshot jsonb not null default '{}', emitter_snapshot jsonb not null default '{}', vehicle jsonb not null default '{}',
 delivery_address text not null default '', transport_reason text not null default '', carrier text not null default '', transport_at timestamptz, packages integer check(packages is null or packages>=0), notes text not null default '',
 lines jsonb not null default '[]', total numeric(16,2) not null default 0, version integer not null default 1,
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), issued_at timestamptz, cancelled_at timestamptz, cancellation_reason text,
 unique(kind,year,number)
);
create index delivery_documents_client_date on public.delivery_documents(client_id,document_date desc);
create index delivery_documents_date on public.delivery_documents(document_date desc,created_at desc);
create table public.delivery_counters(kind text not null,year integer not null,last_number integer not null,last_date date not null,primary key(kind,year));

alter table public.business_clients enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.delivery_documents enable row level security;
alter table public.delivery_counters enable row level security;
create policy clients_access on public.business_clients for all to authenticated using((select auth.uid()) is not null) with check((select auth.uid()) is not null);
create policy settings_access on public.delivery_settings for select to authenticated using((select auth.uid()) is not null);
create policy settings_update on public.delivery_settings for update to authenticated using((select auth.uid()) is not null) with check((select auth.uid()) is not null);
create policy documents_read on public.delivery_documents for select to authenticated using((select auth.uid()) is not null);
revoke all on public.business_clients,public.delivery_settings,public.delivery_documents,public.delivery_counters from public,anon,authenticated;
grant select,insert,update,delete on public.business_clients to authenticated;
grant select,update on public.delivery_settings to authenticated;
grant select on public.delivery_documents to authenticated;

-- Validate decimals before casting, and round each line once in PostgreSQL numeric.
create function public.delivery_validated_lines(p_lines jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; product public.products; qty numeric; price numeric; discount numeric; output jsonb:='[]';
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 500 then raise exception 'Aggiungi da 1 a 500 righe al documento.'; end if;
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

create function public.save_delivery_document(p_id uuid,p_draft jsonb,p_expected_version integer default null) returns uuid
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
 if octet_length(p_draft::text)>1000000 then raise exception 'Il documento contiene troppi dati. Riduci le descrizioni.'; end if;
 if coalesce(p_draft->'vehicle'->>'kilometres','')<>'' and (p_draft->'vehicle'->>'kilometres')!~ '^\d{1,9}$' then raise exception 'Inserisci chilometri interi, a partire da zero.'; end if;
 insert into public.delivery_documents(id,client_id,kind,document_date,client_snapshot,vehicle,delivery_address,transport_reason,carrier,transport_at,packages,notes,lines,total)
 values(p_id,customer.id,kind,doc_date,to_jsonb(customer)-'updated_at',coalesce(p_draft->'vehicle','{}'),coalesce(p_draft->>'delivery_address',''),coalesce(p_draft->>'transport_reason',''),coalesce(p_draft->>'carrier',''),nullif(p_draft->>'transport_at','')::timestamptz,nullif(p_draft->>'packages','')::integer,coalesce(p_draft->>'notes',''),lines,total)
 on conflict(id) do update set client_id=excluded.client_id,kind=excluded.kind,document_date=excluded.document_date,client_snapshot=excluded.client_snapshot,vehicle=excluded.vehicle,delivery_address=excluded.delivery_address,transport_reason=excluded.transport_reason,carrier=excluded.carrier,transport_at=excluded.transport_at,packages=excluded.packages,notes=excluded.notes,lines=excluded.lines,total=excluded.total,version=delivery_documents.version+1,updated_at=now();
 return p_id;
end; $$;

create function public.issue_delivery_document(p_id uuid,p_expected_version integer) returns uuid
language plpgsql security definer set search_path=public as $$
declare doc public.delivery_documents; customer public.business_clients; settings public.delivery_settings; progressive integer; doc_year integer;
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 select * into doc from public.delivery_documents where id=p_id for update;
 if not found then raise exception 'Documento non trovato. Ricarica la pagina.'; end if;
 if doc.status='issued' then return p_id; end if;
 if doc.status<>'draft' then raise exception 'Questo documento è annullato e non può essere emesso.'; end if;
 if doc.version<>p_expected_version then raise exception 'Il documento è cambiato. Riaprilo prima di emetterlo.'; end if;
 select * into settings from public.delivery_settings where id=true for share;
 if not settings.fiscal_verified then raise exception 'Completa i dati dell’officina e la verifica amministrativa nelle impostazioni documenti prima di emettere.'; end if;
 if btrim(settings.name)='' or btrim(settings.address)='' or btrim(settings.city)='' or (btrim(settings.vat_number)='' and btrim(settings.tax_code)='') then raise exception 'Completa nome, indirizzo e dati fiscali dell’officina nelle impostazioni documenti.'; end if;
 select * into customer from public.business_clients where id=doc.client_id and active for share;
 if not found or btrim(customer.address)='' or btrim(customer.city)='' or (btrim(customer.vat_number)='' and btrim(customer.tax_code)='') then raise exception 'Completa indirizzo e partita IVA o codice fiscale dell’azienda prima di emettere.'; end if;
 if doc.document_date>current_date then raise exception 'La data è futura. Salva una bozza oppure scegli la data corretta prima di emettere.'; end if;
 if doc.kind='ddt' and (btrim(doc.transport_reason)='' or btrim(doc.delivery_address)='') then raise exception 'Inserisci causale e indirizzo di destinazione per il documento di trasporto.'; end if;
 doc_year:=extract(year from doc.document_date)::integer;
 insert into public.delivery_counters(kind,year,last_number,last_date) values(doc.kind,doc_year,1,doc.document_date)
 on conflict(kind,year) do update set last_number=delivery_counters.last_number+1,last_date=excluded.last_date where delivery_counters.last_date<=excluded.last_date returning last_number into progressive;
 if progressive is null then raise exception 'La data precede un documento già emesso in questa serie. Scegli una data successiva o contatta l’amministrazione.'; end if;
 update public.delivery_documents set status='issued',number=progressive,year=doc_year,client_snapshot=to_jsonb(customer)-'updated_at',emitter_snapshot=to_jsonb(settings)-'updated_at'-'fiscal_verified',issued_at=now(),updated_at=now(),version=version+1 where id=p_id;
 return p_id;
end; $$;

create function public.cancel_delivery_document(p_id uuid,p_reason text,p_expected_version integer) returns void
language plpgsql security definer set search_path=public as $$
declare doc public.delivery_documents;
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 select * into doc from public.delivery_documents where id=p_id for update;
 if not found then raise exception 'Documento non trovato. Ricarica la pagina.'; end if;
 if doc.status='void' then return; end if;
 if doc.status<>'issued' or doc.version<>p_expected_version then raise exception 'Il documento è cambiato. Riaprilo prima di annullarlo.'; end if;
 if length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Indica il motivo dell’annullamento, fino a 1000 caratteri.'; end if;
 update public.delivery_documents set status='void',cancellation_reason=btrim(p_reason),cancelled_at=now(),updated_at=now(),version=version+1 where id=p_id;
end; $$;
create function public.delete_delivery_draft(p_id uuid,p_expected_version integer) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Accedi per gestire i documenti.'; end if;
 delete from public.delivery_documents where id=p_id and status='draft' and version=p_expected_version;
 if not found then raise exception 'La bozza è cambiata o è già emessa. Riaprila prima di eliminarla.'; end if;
end; $$;
revoke all on function public.delivery_validated_lines(jsonb),public.save_delivery_document(uuid,jsonb,integer),public.issue_delivery_document(uuid,integer),public.cancel_delivery_document(uuid,text,integer),public.delete_delivery_draft(uuid,integer) from public,anon,authenticated;
grant execute on function public.save_delivery_document(uuid,jsonb,integer),public.issue_delivery_document(uuid,integer),public.cancel_delivery_document(uuid,text,integer),public.delete_delivery_draft(uuid,integer) to authenticated;
notify pgrst,'reload schema';

create view public.delivery_documents_view with (security_invoker=true) as
 select id,client_id,kind,status,number,year,document_date,client_snapshot,emitter_snapshot,vehicle,delivery_address,transport_reason,carrier,transport_at,packages,notes,lines,total::text as total,version,created_by,created_at,updated_at,issued_at,cancelled_at,cancellation_reason from public.delivery_documents;
revoke all on public.delivery_documents_view from public,anon;
grant select on public.delivery_documents_view to authenticated;
create or replace function public.save_catalogue_product(p_product_id uuid, p_draft jsonb, p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  target_id uuid; existing public.products; code text; product_name text;
  new_stock integer; delta integer; item jsonb; price_list uuid; val text;
begin
  if auth.uid() is null then raise exception 'Accedi per gestire i prodotti.'; end if;
  code := upper(btrim(coalesce(p_draft->>'internal_code','')));
  product_name := btrim(coalesce(p_draft->>'name',''));
  if code='' then raise exception 'Il codice prodotto è obbligatorio.'; end if;
  if p_product_id is not null then
    select * into existing from public.products where id=p_product_id for update;
    if not found then raise exception 'Il prodotto non esiste più.'; end if;
    if p_expected_updated_at is not null and existing.updated_at <> p_expected_updated_at then
      raise exception 'Il prodotto è cambiato nel frattempo. Riapri la scheda prima di salvare.';
    end if;
  end if;
  new_stock := coalesce((p_draft->>'stockQuantity')::integer, existing.stock_quantity, 0);
  if (p_draft->>'minimumStock')::integer < 0 then raise exception 'La scorta minima non può essere negativa.'; end if;
  if p_product_id is null then
    insert into public.products(internal_code,name,description,brand,category,location,unit,stock_quantity,minimum_stock,supplier,notes,created_by,kind)
    values(code,product_name,coalesce(p_draft->>'description',''),coalesce(p_draft->>'brand',''),coalesce(p_draft->>'category',''),
      coalesce(p_draft->>'location',''),coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),new_stock,(p_draft->>'minimumStock')::integer,
      coalesce(p_draft->>'supplier',''),coalesce(p_draft->>'notes',''),auth.uid(),coalesce(p_draft->>'kind','goods')) returning id into target_id;
    delta := new_stock;
  else
    target_id := p_product_id;
    delta := new_stock-existing.stock_quantity;
    update public.products set internal_code=code,name=product_name,description=coalesce(p_draft->>'description',''),
      brand=coalesce(p_draft->>'brand',''),category=coalesce(p_draft->>'category',''),location=coalesce(p_draft->>'location',''),
      unit=coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),stock_quantity=new_stock,minimum_stock=(p_draft->>'minimumStock')::integer,
      supplier=coalesce(p_draft->>'supplier',''),notes=coalesce(p_draft->>'notes',''),kind=coalesce(p_draft->>'kind',existing.kind) where id=target_id;
  end if;
  delete from public.product_identifiers where product_id=target_id;
  -- Barcode and internal code are identical; one searchable identifier represents both.
  insert into public.product_identifiers(product_id,kind,value,normalized_value) values(target_id,'barcode',code,code);
  for item in select value from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('kind','supplier_code','value',p_draft->>'supplierCode'),
      jsonb_build_object('kind','mav','value',p_draft->>'mav')) ||
      coalesce((select jsonb_agg(jsonb_build_object('kind','cross_reference','value',value)) from jsonb_array_elements_text(coalesce(p_draft->'crossReferences','[]'::jsonb))), '[]'::jsonb)) loop
    val := btrim(coalesce(item->>'value',''));
    if val <> '' then insert into public.product_identifiers(product_id,kind,value,normalized_value)
      values(target_id,item->>'kind',val,upper(val)) on conflict(product_id,normalized_value) do nothing; end if;
  end loop;
  delete from public.product_prices where product_id=target_id;
  for item in select value from jsonb_array_elements(coalesce(p_draft->'prices','[]'::jsonb)) loop
    if btrim(coalesce(item->>'name',''))='' or (item->>'amount') is null then raise exception 'Ogni prezzo richiede nome e importo.'; end if;
    insert into public.price_lists(name) values(btrim(item->>'name')) on conflict(name) do update set name=excluded.name returning id into price_list;
    insert into public.product_prices(product_id,price_list_id,amount) values(target_id,price_list,(item->>'amount')::numeric);
  end loop;
  if delta <> 0 then insert into public.inventory_movements(product_id,delta,reason,note,created_by)
    values(target_id,delta,case when p_product_id is null then 'initial_import' else 'manual_adjustment' end,'Salvataggio scheda prodotto',auth.uid()); end if;
  return target_id;
end;
$$;
