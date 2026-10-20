-- Synthetic records only; all changes are rolled back.
begin;
set local role anon;
do $$ begin
  if exists(select 1 from public.products) then raise exception 'FAIL: anonymous catalogue access'; end if;
  if has_function_privilege('anon','public.save_catalogue_product(uuid,jsonb,timestamptz)','EXECUTE') then
    raise exception 'FAIL: anonymous product save';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from auth.users order by created_at limit 1), true);
set local role authenticated;
do $$
declare
  target uuid; code text := 'QA-COST-' || gen_random_uuid()::text;
  saved_at timestamptz; invalid text; rejected boolean; lines jsonb;
  client_id uuid; document_id uuid := gen_random_uuid();
begin
  target := public.save_catalogue_product(null,jsonb_build_object('internal_code',code,'purchasePrice','73.25',
    'prices',jsonb_build_array(jsonb_build_object('name','Prezzo vendita','amount',180))));
  if (select purchase_price from public.products where id=target) is distinct from 73.25::numeric then raise exception 'FAIL: create'; end if;
  if (select count(*) from public.product_prices where product_id=target) <> 1 then raise exception 'FAIL: sale price separation'; end if;

  select updated_at into saved_at from public.products where id=target;
  perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code,'purchasePrice','82.50'),saved_at);
  if (select purchase_price from public.products where id=target) is distinct from 82.50::numeric then raise exception 'FAIL: edit'; end if;
  perform public.import_catalogue_product(jsonb_build_object('internal_code',code,'name','Imported name'),'QA cost preservation');
  if (select purchase_price from public.products where id=target) is distinct from 82.50::numeric then raise exception 'FAIL: import preservation'; end if;

  foreach invalid in array array['-1','1.001','NaN','Infinity','10000000000','invalid'] loop
    rejected := false;
    begin
      perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code,'purchasePrice',invalid,'stockQuantity',777));
    exception when others then rejected := true;
    end;
    if not rejected or (select purchase_price from public.products where id=target) is distinct from 82.50::numeric
      or (select stock_quantity from public.products where id=target) <> 0 then raise exception 'FAIL: invalid input / atomic rollback: %',invalid; end if;
  end loop;
  rejected := false;
  begin
    perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code,'purchasePrice','1'),'2000-01-01'::timestamptz);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: stale edit protection'; end if;

  -- Even unsolicited internal fields in a draft must not survive the server document projection.
  insert into public.business_clients(name) values('QA purchase cost isolation') returning id into client_id;
  perform public.save_delivery_document(document_id,jsonb_build_object('client_id',client_id,'document_date','2026-10-20',
    'lines',jsonb_build_array(jsonb_build_object('product_id',target,
    'description','QA cost isolation','quantity','1','unit_price','180','discount','0',
    'purchase_price','82.50','purchasePrice','82.50'))),null);
  select d.lines into lines from public.delivery_documents_view d where d.id=document_id;
  if (lines->0) ? 'purchase_price' or (lines->0) ? 'purchasePrice' or lines->0->>'unit_price' <> '180' then
    raise exception 'FAIL: internal cost in document';
  end if;
  perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code,'purchasePrice','0'));
  if (select purchase_price from public.products where id=target) is distinct from 0::numeric then raise exception 'FAIL: zero'; end if;
  perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code,'purchasePrice',null));
  if (select purchase_price from public.products where id=target) is not null then raise exception 'FAIL: clear'; end if;
  perform public.save_catalogue_product(target,jsonb_build_object('internal_code',code));
  if (select purchase_price from public.products where id=target) is not null then raise exception 'FAIL: unset'; end if;
end $$;
rollback;
