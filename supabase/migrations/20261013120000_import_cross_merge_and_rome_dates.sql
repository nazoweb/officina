-- Reimporting Excel adds cross-references instead of replacing them: removing one is done from the product form.
create or replace function public.import_catalogue_product(p_draft jsonb,p_source text default 'Import Excel')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing public.products; target uuid; merged jsonb; old_prices jsonb; old_cross jsonb; supplier_code text; mav_code text; code text;
begin
  if auth.uid() is null then raise exception 'Accedi per gestire i prodotti.'; end if;
  code:=upper(btrim(coalesce(p_draft->>'internal_code','')));
  if code='' then raise exception 'Il codice prodotto è obbligatorio.'; end if;
  -- Serialize imports of the same code, including when it does not exist yet.
  perform pg_advisory_xact_lock(hashtextextended(code,0));
  select * into existing from public.products where internal_code=code for update;
  if existing.id is null then
    target:=public.save_catalogue_product(null,p_draft);
    return jsonb_build_object('created',true,'productId',target);
  end if;
  select coalesce(jsonb_agg(value),'[]') into old_cross from public.product_identifiers where product_id=existing.id and kind='cross_reference';
  select value into supplier_code from public.product_identifiers where product_id=existing.id and kind='supplier_code' order by value limit 1;
  select value into mav_code from public.product_identifiers where product_id=existing.id and kind='mav' order by value limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('name',name,'amount',amount)),'[]') into old_prices
    from (select l.name,p.amount from public.product_prices p join public.price_lists l on l.id=p.price_list_id where p.product_id=existing.id
      and not exists(select 1 from jsonb_array_elements(coalesce(p_draft->'prices','[]')) n where btrim(n->>'name')=l.name)) prices;
  merged:=jsonb_build_object('internal_code',code,'name',existing.name,'description',existing.description,'brand',existing.brand,'category',existing.category,
    'location',existing.location,'unit',existing.unit,'minimumStock',existing.minimum_stock,'supplier',existing.supplier,'notes',existing.notes,
    'supplierCode',supplier_code,'mav',mav_code,'crossReferences',old_cross) || p_draft ||
    jsonb_build_object('stockQuantity',existing.stock_quantity,'prices',old_prices || coalesce(p_draft->'prices','[]'),
      'crossReferences',(select coalesce(jsonb_agg(distinct code_value),'[]') from (
        select jsonb_array_elements_text(old_cross) code_value
        union select jsonb_array_elements_text(coalesce(p_draft->'crossReferences','[]'))) codes));
  target:=public.save_catalogue_product(existing.id,merged,existing.updated_at);
  return jsonb_build_object('created',false,'productId',target);
end; $$;

-- The workshop works on Italian time: between midnight and 02:00 a document dated today is not "future" (the database runs in UTC).
create or replace function public.issue_delivery_document(p_id uuid,p_expected_version integer) returns uuid
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
 if doc.document_date>(now() at time zone 'Europe/Rome')::date then raise exception 'La data è futura. Salva una bozza oppure scegli la data corretta prima di emettere.'; end if;
 if doc.kind='ddt' and (btrim(doc.transport_reason)='' or btrim(doc.delivery_address)='') then raise exception 'Inserisci causale e indirizzo di destinazione per il documento di trasporto.'; end if;
 doc_year:=extract(year from doc.document_date)::integer;
 insert into public.delivery_counters(kind,year,last_number,last_date) values(doc.kind,doc_year,1,doc.document_date)
 on conflict(kind,year) do update set last_number=delivery_counters.last_number+1,last_date=excluded.last_date where delivery_counters.last_date<=excluded.last_date returning last_number into progressive;
 if progressive is null then raise exception 'La data precede un documento già emesso in questa serie. Scegli una data successiva o contatta l’amministrazione.'; end if;
 update public.delivery_documents set status='issued',number=progressive,year=doc_year,client_snapshot=to_jsonb(customer)-'updated_at',emitter_snapshot=to_jsonb(settings)-'updated_at'-'fiscal_verified',issued_at=now(),updated_at=now(),version=version+1 where id=p_id;
 return p_id;
end; $$;

notify pgrst,'reload schema';
