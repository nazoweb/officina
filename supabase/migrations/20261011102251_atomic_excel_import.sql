-- One transaction per product: retries/reimport cannot duplicate initial stock or leave half a product.
create function public.import_catalogue_product(p_draft jsonb,p_source text default 'Import Excel')
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
    jsonb_build_object('stockQuantity',existing.stock_quantity,'prices',old_prices || coalesce(p_draft->'prices','[]'));
  target:=public.save_catalogue_product(existing.id,merged,existing.updated_at);
  return jsonb_build_object('created',false,'productId',target);
end; $$;
revoke all on function public.import_catalogue_product(jsonb,text) from public,anon;
grant execute on function public.import_catalogue_product(jsonb,text) to authenticated;
notify pgrst,'reload schema';
