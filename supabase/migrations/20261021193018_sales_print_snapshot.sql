-- Production uses auth.users directly; no public profiles table is required.
create or replace function sales_private.command(p_action text,p_id uuid,p_version integer,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); s public.sales; product public.products; customer public.business_clients;
 result jsonb; item jsonb; target_line jsonb; new_lines jsonb; validated jsonb; stamp jsonb; settings jsonb;
 idx integer; qty numeric; price numeric; calculated_total numeric; changed integer; receipt_year integer; receipt_number integer;
 doc_id uuid; doc_version integer; operator_label text; requested_product uuid; operation_id uuid;
begin
 if actor is null then raise exception 'Accedi per gestire le vendite.'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>1000000 then raise exception 'Dati vendita non validi.'; end if;
 select coalesce(email,'Operatore') into operator_label from auth.users where id=actor;
 operator_label:=coalesce(operator_label,'Operatore');

 if p_action='open' then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,730));
  select * into s from public.sales where created_by=actor and status='draft';
  if not found then insert into public.sales(created_by) values(actor) returning * into s; end if;
  return to_jsonb(s)||jsonb_build_object('total',s.total::text);
 end if;

 if p_action in ('snapshot','remove_reorder') then
  -- Shared lock order makes every print an exact snapshot of the pending list at one instant.
  perform pg_advisory_xact_lock(731);
  if p_action='snapshot' then
   if p_id is null then raise exception 'Dati vendita non validi.'; end if;
   select to_jsonb(p) into result from public.reorder_prints p where id=p_id;
   if found then return result; end if;
   select jsonb_agg(jsonb_build_object('id',e.id,'sale_id',e.sale_id,'code',e.code,'description',e.description,
     'supplier',e.supplier,'supplier_code',e.supplier_code,'unit',e.unit,'quantity',e.quantity,'sold_at',e.sold_at,
     'sale_number',sold_sale.number,'sale_year',sold_sale.year,'sale_status',sold_sale.status) order by e.sold_at,e.id)
     into stamp from public.reorder_entries e join public.sales sold_sale on sold_sale.id=e.sale_id where e.removed_at is null;
   if stamp is null then raise exception 'La lista da riordinare è vuota.'; end if;
   insert into public.reorder_prints(id,created_by,operator_name,lines) values(p_id,actor,operator_label,stamp) returning to_jsonb(reorder_prints) into result;
   return result;
  else
   if jsonb_typeof(p_payload->'ids') is distinct from 'array' or jsonb_array_length(p_payload->'ids') not between 1 and 10000 then raise exception 'Seleziona le voci da rimuovere.'; end if;
   update public.reorder_entries set removed_at=now(),removed_by=actor
    where removed_at is null and id in(select value::uuid from jsonb_array_elements_text(p_payload->'ids'));
   get diagnostics changed=row_count;
   return jsonb_build_object('removed',changed);
  end if;
 end if;

 select * into s from public.sales where id=p_id for update;
 if not found or (s.status='draft' and s.created_by<>actor) then raise exception 'Carrello non disponibile.'; end if;
 if p_action='close' and s.status<>'draft' then return to_jsonb(s)||jsonb_build_object('total',s.total::text); end if;
 if p_action='document' and s.delivery_document_id is not null then return to_jsonb(s)||jsonb_build_object('total',s.total::text); end if;
 if p_action='void' and s.status='void' then return to_jsonb(s)||jsonb_build_object('total',s.total::text); end if;
 if p_action not in ('add') and (p_version is null or s.version<>p_version) then raise exception 'La vendita è cambiata. Ricarica prima di continuare.'; end if;
 if p_action in ('edit','add','line','discard','close') and s.status<>'draft' then raise exception 'La vendita è già chiusa. Puoi soltanto annullarla.'; end if;

 if p_action='discard' then
  delete from public.sales where id=s.id;
  return jsonb_build_object('discarded',true);
 elsif p_action='edit' then
  if length(coalesce(p_payload->>'customer_name',''))>160 or length(coalesce(p_payload->>'notes',''))>2000
   or coalesce(p_payload->>'payment_method','') not in ('','Contanti','Carta','Bonifico','Altro') then raise exception 'Dati vendita non validi.'; end if;
  if nullif(p_payload->>'client_id','') is not null then
   select * into customer from public.business_clients where id=(p_payload->>'client_id')::uuid and active;
   if not found then raise exception 'Scegli un’azienda disponibile prima di salvare.'; end if;
  end if;
  update public.sales set client_id=customer.id,customer_name=coalesce(nullif(btrim(customer.name),''),btrim(p_payload->>'customer_name'),''),
    notes=coalesce(p_payload->>'notes',''),payment_method=coalesce(p_payload->>'payment_method',''),version=version+1,updated_at=now()
    where id=s.id returning * into s;
 elsif p_action='add' then
  -- Idempotency key survives retries; repeated scans use different keys and increment once each.
  operation_id:=(p_payload->>'operation_id')::uuid;
  if operation_id is null then raise exception 'Dati vendita non validi.'; end if;
  if exists(select 1 from sales_private.scan_operations where id=operation_id and sale_id=s.id) then return to_jsonb(s)||jsonb_build_object('total',s.total::text); end if;
  requested_product:=(p_payload->>'product_id')::uuid;
  select * into product from public.products where id=requested_product and active;
  if not found then raise exception 'Prodotto non disponibile.'; end if;
  select value,ordinality::integer-1 into target_line,idx from jsonb_array_elements(s.lines) with ordinality where value->>'product_id'=requested_product::text;
  if target_line is null then
   if jsonb_array_length(s.lines)>=500 then raise exception 'Puoi inserire al massimo 500 righe nella vendita.'; end if;
   select pp.amount into price from public.product_prices pp join public.price_lists pl on pl.id=pp.price_list_id
    where pp.product_id=product.id and pl.active order by (pl.name='Prezzo vendita') desc,pl.sort_order,pl.name limit 1;
   target_line:=jsonb_build_object('product_id',product.id,'description',coalesce(nullif(product.name,''),nullif(product.description,''),product.internal_code),
     'quantity','1','unit_price',coalesce(price,0)::text,'discount','0');
   new_lines:=s.lines||jsonb_build_array(target_line);
  else
   new_lines:=jsonb_set(s.lines,array[idx::text,'quantity'],to_jsonb(((target_line->>'quantity')::numeric+1)::text));
  end if;
  validated:=public.delivery_validated_lines(new_lines);
  insert into sales_private.scan_operations(id,sale_id) values(operation_id,s.id);
 elsif p_action='line' then
  idx:=(p_payload->>'index')::integer;
  if idx is null or idx<0 or idx>=jsonb_array_length(s.lines) then raise exception 'Riga vendita non disponibile.'; end if;
  if p_payload->>'quantity'='0' then new_lines:=s.lines-idx;
  else
   target_line:=(s.lines->idx)||jsonb_build_object('quantity',p_payload->>'quantity','unit_price',p_payload->>'unit_price','discount',p_payload->>'discount');
   new_lines:=jsonb_set(s.lines,array[idx::text],target_line);
  end if;
  if jsonb_array_length(new_lines)=0 then validated:='[]'; else validated:=public.delivery_validated_lines(new_lines); end if;
 elsif p_action='close' then
  validated:=public.delivery_validated_lines(s.lines);
  -- Deterministic product lock order avoids deadlocks between simultaneous sales and legacy orders.
  perform 1 from public.products where id in(select (value->>'product_id')::uuid from jsonb_array_elements(validated)) order by id for update;
  if exists(select 1 from jsonb_array_elements(validated) where value->>'kind'='goods' and (value->>'quantity')::numeric<>trunc((value->>'quantity')::numeric)) then raise exception 'Le quantità dei ricambi devono essere intere.'; end if;
  if s.client_id is not null then
   select * into customer from public.business_clients where id=s.client_id and active for share;
   if not found then raise exception 'Scegli un’azienda disponibile prima di salvare.'; end if;
  end if;
  if coalesce((p_payload->>'issue_ddt')::boolean,false) then
   doc_id:=gen_random_uuid();
   perform public.save_delivery_document(doc_id,jsonb_build_object('client_id',s.client_id,'document_date',(now() at time zone 'Europe/Rome')::date,
     'delivery_address',coalesce(nullif(customer.delivery_address,''),nullif(concat_ws(', ',nullif(customer.address,''),nullif(customer.city,'')),''),''),
     'transport_reason','Vendita','carrier',coalesce(p_payload->>'carrier','Ritiro a cura del destinatario'),'lines',validated,'notes',s.notes),null);
   perform public.issue_delivery_document(doc_id,1);
  end if;
  receipt_year:=extract(year from now() at time zone 'Europe/Rome')::integer;
  insert into sales_private.counters(year,last_number) values(receipt_year,1)
   on conflict(year) do update set last_number=counters.last_number+1 returning last_number into receipt_number;
  select to_jsonb(d)-'id'-'updated_at'-'fiscal_verified' into settings from public.delivery_settings d where id=true;
  select coalesce(sum((value->>'line_total')::numeric),0) into calculated_total from jsonb_array_elements(validated);
  perform pg_advisory_xact_lock(731);
  update public.sales set status='closed',number=receipt_number,year=receipt_year,closed_at=now(),closed_by=actor,operator_name=operator_label,
   client_snapshot=case when customer.id is not null then to_jsonb(customer)-'updated_at' else jsonb_build_object('name',s.customer_name) end,emitter_snapshot=coalesce(settings,'{}'),
   lines=validated,total=calculated_total,delivery_document_id=doc_id,version=version+1,updated_at=now() where id=s.id returning * into s;
  for item,idx in select value,ordinality::integer-1 from jsonb_array_elements(validated) with ordinality loop
   if item->>'kind'='goods' then
    qty:=(item->>'quantity')::numeric;
    update public.products set stock_quantity=stock_quantity-qty::integer where id=(item->>'product_id')::uuid;
    insert into public.inventory_movements(product_id,sale_id,delta,reason,note,created_by)
      values((item->>'product_id')::uuid,s.id,-qty::integer,'sale','Vendita '||receipt_number||'/'||receipt_year,actor);
    select * into product from public.products where id=(item->>'product_id')::uuid;
    insert into public.reorder_entries(sale_id,product_id,line_index,code,description,supplier,supplier_code,unit,quantity,sold_at)
     values(s.id,product.id,idx,item->>'code',item->>'description',product.supplier,
       coalesce((select value from public.product_identifiers where product_id=product.id and kind='supplier_code' order by value limit 1),''),item->>'unit',qty::integer,s.closed_at);
   end if;
  end loop;
 elsif p_action='document' then
  if s.status<>'closed' then raise exception 'Puoi creare il DDT soltanto per una vendita chiusa.'; end if;
  select * into customer from public.business_clients where id=s.client_id and active;
  if not found then raise exception 'Scegli un’azienda disponibile prima di salvare.'; end if;
  doc_id:=gen_random_uuid();
  perform public.save_delivery_document(doc_id,jsonb_build_object('client_id',s.client_id,'document_date',(now() at time zone 'Europe/Rome')::date,
    'delivery_address',coalesce(nullif(customer.delivery_address,''),concat_ws(', ',nullif(customer.address,''),nullif(customer.city,''))),
    'transport_reason','Vendita','carrier','Ritiro a cura del destinatario','lines',s.lines,'notes',s.notes),null);
  -- The original sale lines and amounts are authoritative even if catalogue descriptions changed.
  update public.delivery_documents set lines=s.lines,total=s.total where id=doc_id;
  perform public.issue_delivery_document(doc_id,1);
  update public.sales set delivery_document_id=doc_id,version=version+1,updated_at=now() where id=s.id returning * into s;
 elsif p_action='void' then
  if s.status<>'closed' then raise exception 'Puoi annullare soltanto una vendita chiusa.'; end if;
  if length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000 then raise exception 'Indica il motivo dell’annullamento, fino a 1000 caratteri.'; end if;
  -- Reorder entries intentionally remain until a human removes them, including cancelled sales.
  perform 1 from public.products where id in(select (value->>'product_id')::uuid from jsonb_array_elements(s.lines)) order by id for update;
  if s.delivery_document_id is not null then
   select version into doc_version from public.delivery_documents where id=s.delivery_document_id and status='issued' for update;
   if found then perform public.cancel_delivery_document(s.delivery_document_id,p_payload->>'reason',doc_version); end if;
  end if;
  perform pg_advisory_xact_lock(731);
  if coalesce((p_payload->>'restore_stock')::boolean,true) then
   for item in select value from jsonb_array_elements(s.lines) where value->>'kind'='goods' loop
    update public.products set stock_quantity=stock_quantity+(item->>'quantity')::integer where id=(item->>'product_id')::uuid;
    if not found then raise exception 'Un ricambio è stato eliminato. Annulla senza ripristinare il magazzino e verifica le quantità.'; end if;
    insert into public.inventory_movements(product_id,sale_id,delta,reason,note,created_by)
     values((item->>'product_id')::uuid,s.id,(item->>'quantity')::integer,'sale_void',p_payload->>'reason',actor);
   end loop;
  end if;
  update public.sales set status='void',cancelled_at=now(),cancelled_by=actor,cancellation_reason=btrim(p_payload->>'reason'),
   stock_restored=coalesce((p_payload->>'restore_stock')::boolean,true),version=version+1,updated_at=now() where id=s.id returning * into s;
 else raise exception 'Operazione vendita non disponibile.';
 end if;
 if p_action in ('add','line') then
  if exists(select 1 from jsonb_array_elements(validated) where value->>'kind'='goods' and (value->>'quantity')::numeric<>trunc((value->>'quantity')::numeric)) then raise exception 'Le quantità dei ricambi devono essere intere.'; end if;
  select coalesce(sum((value->>'line_total')::numeric),0) into calculated_total from jsonb_array_elements(validated);
  update public.sales set lines=validated,total=calculated_total,version=version+1,updated_at=now() where id=s.id returning * into s;
 end if;
 return to_jsonb(s)||jsonb_build_object('total',s.total::text);
end $$;
