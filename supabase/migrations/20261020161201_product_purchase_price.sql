-- Internal purchase cost is deliberately separate from sale price lists and document lines.
-- Products remain protected by the existing staff-only authenticated RLS policy.
alter table public.products add column purchase_price numeric
  constraint products_purchase_price_valid check (
    purchase_price >= 0 and purchase_price <= 9999999999.99 and scale(purchase_price) <= 2
  );
comment on column public.products.purchase_price is 'Prezzo d’acquisto in euro, riservato agli operatori. Escluso dai documenti per il cliente.';

create or replace function public.save_catalogue_product(p_product_id uuid, p_draft jsonb, p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  target_id uuid; existing public.products; code text; product_name text;
  purchase_cost numeric; new_stock integer; delta integer; item jsonb; price_list uuid; val text;
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
  -- Missing key preserves the value for Excel imports and older clients; explicit null clears it.
  purchase_cost := case when p_draft ? 'purchasePrice'
    then (p_draft->>'purchasePrice')::numeric else existing.purchase_price end;
  if purchase_cost < 0 or purchase_cost > 9999999999.99 or scale(purchase_cost) > 2 then
    raise exception 'Il prezzo d’acquisto deve essere un importo positivo o zero con al massimo due decimali (massimo 9.999.999.999,99 €).';
  end if;
  new_stock := coalesce((p_draft->>'stockQuantity')::integer, existing.stock_quantity, 0);
  if (p_draft->>'minimumStock')::integer < 0 then raise exception 'La scorta minima non può essere negativa.'; end if;
  if p_product_id is null then
    insert into public.products(internal_code,name,description,brand,category,location,unit,stock_quantity,minimum_stock,supplier,notes,created_by,kind,purchase_price)
    values(code,product_name,coalesce(p_draft->>'description',''),coalesce(p_draft->>'brand',''),coalesce(p_draft->>'category',''),
      coalesce(p_draft->>'location',''),coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),new_stock,(p_draft->>'minimumStock')::integer,
      coalesce(p_draft->>'supplier',''),coalesce(p_draft->>'notes',''),auth.uid(),coalesce(p_draft->>'kind','goods'),purchase_cost) returning id into target_id;
    delta := new_stock;
  else
    target_id := p_product_id;
    delta := new_stock-existing.stock_quantity;
    update public.products set internal_code=code,name=product_name,description=coalesce(p_draft->>'description',''),
      brand=coalesce(p_draft->>'brand',''),category=coalesce(p_draft->>'category',''),location=coalesce(p_draft->>'location',''),
      unit=coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),stock_quantity=new_stock,minimum_stock=(p_draft->>'minimumStock')::integer,
      supplier=coalesce(p_draft->>'supplier',''),notes=coalesce(p_draft->>'notes',''),kind=coalesce(p_draft->>'kind',existing.kind),purchase_price=purchase_cost where id=target_id;
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

notify pgrst, 'reload schema';
