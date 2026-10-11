begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true);
set local role authenticated;
do $$
#variable_conflict use_variable
declare suffix text:=upper(gen_random_uuid()::text); code text; product_id uuid; result jsonb; rejected boolean; event_id uuid:=gen_random_uuid(); initial_moves integer;
begin
  code:='QA-IMPORT-'||suffix;
  result:=public.import_catalogue_product(jsonb_build_object('internal_code',code,'name','Prodotto prova','stockQuantity',10,'supplierCode','FORN-'||suffix,'crossReferences',jsonb_build_array('CROSS-'||suffix),'prices',jsonb_build_array(jsonb_build_object('name','QA '||suffix,'amount',0))));
  product_id:=(result->>'productId')::uuid;
  if not (result->>'created')::boolean then raise exception 'FAIL: first import creates product'; end if;
  select count(*) into initial_moves from public.inventory_movements where inventory_movements.product_id=product_id;
  result:=public.import_catalogue_product(jsonb_build_object('internal_code',lower(code),'stockQuantity',99,'brand','Nuova marca','prices','[]'::jsonb));
  if (result->>'created')::boolean or (result->>'productId')::uuid<>product_id then raise exception 'FAIL: repeated import reuses product'; end if;
  if (select stock_quantity from public.products where id=product_id)<>10 or (select name from public.products where id=product_id)<>'Prodotto prova' then raise exception 'FAIL: repeat import preserves stock and missing fields'; end if;
  if not exists(select 1 from public.product_prices where product_prices.product_id=product_id and amount=0) or not exists(select 1 from public.product_identifiers where product_identifiers.product_id=product_id and kind='supplier_code') then raise exception 'FAIL: missing prices/codes preserved'; end if;
  if (select count(*) from public.inventory_movements where inventory_movements.product_id=product_id)<>initial_moves then raise exception 'FAIL: repeat import does not duplicate initial stock'; end if;
  rejected:=false;
  begin perform public.import_catalogue_product(jsonb_build_object('internal_code',code,'name','Wrong name','prices',jsonb_build_array(jsonb_build_object('name','QA '||suffix,'amount',-1)))); exception when check_violation then rejected:=true; end;
  if not rejected or (select name from public.products where id=product_id)<>'Prodotto prova' then raise exception 'FAIL: failed import rolls back whole product'; end if;
  rejected:=false;
  begin perform public.save_catalogue_product(null,jsonb_build_object('internal_code',code)); exception when unique_violation then rejected:=true; end;
  if not rejected then raise exception 'FAIL: duplicate manual code'; end if;
  rejected:=false;
  begin perform public.save_catalogue_product(null,jsonb_build_object('internal_code',' ')); exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'FAIL: missing required code'; end if;
  perform public.record_activity_event(event_id,gen_random_uuid(),'saveProduct','error','/codici/nuovo','{}','Riprova.','42702','column reference id is ambiguous');
  perform public.record_activity_event(event_id,null,'saveProduct','error','/codici/nuovo');
  if (select count(*) from public.activity_events where id=event_id)<>1 then raise exception 'FAIL: log retry idempotent'; end if;
  if (select actor_id from public.activity_events where id=event_id)<>auth.uid() then raise exception 'FAIL: log ownership'; end if;
  rejected:=false;
  begin execute 'select technical_message from public.activity_events limit 1'; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: technical log details must not be readable by browser'; end if;
  if has_function_privilege('anon','public.record_activity_event(uuid,uuid,text,text,text,jsonb,text,text,text)','EXECUTE') then raise exception 'FAIL: anonymous logging'; end if;
end; $$;
rollback;
select 'OK: repeated import, missing parts, zero prices, atomic rollback, duplicates, protected persistent logs' as result;
