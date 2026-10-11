-- Integration checks with synthetic rows, rolled back at the end.
-- Run as the SQL editor role against a database with at least one signed-in staff user.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users order by created_at limit 1), true);
set local role authenticated;
do $$
#variable_conflict use_variable
declare
  suffix text := gen_random_uuid()::text;
  code text; category text; product_id uuid; second_product uuid;
  order_id uuid; item_id uuid; saved_at timestamptz; rejected boolean;
begin
  code := upper('QA-' || suffix);
  category := 'QA CATEGORY ' || suffix;
  product_id := public.save_catalogue_product(null,jsonb_build_object(
    'internal_code',code,'name','Test product','category',category,'stockQuantity',10,
    'crossReferences',jsonb_build_array('QA-CROSS-'||suffix),'prices',jsonb_build_array(jsonb_build_object('name','QA PRICE '||suffix,'amount',0))));
  if not exists(select 1 from public.product_categories where name=category) then raise exception 'FAIL: auto-created category'; end if;
  if not exists(select 1 from public.product_identifiers where product_identifiers.product_id=product_id and kind='barcode' and value=code) then raise exception 'FAIL: automatic barcode'; end if;
  if not exists(select 1 from public.product_prices where product_prices.product_id=product_id and amount=0) then raise exception 'FAIL: zero price'; end if;
  select updated_at into saved_at from public.products where id=product_id;
  rejected := false;
  begin
    perform public.save_catalogue_product(product_id,jsonb_build_object('internal_code',code,'stockQuantity',500,'prices',jsonb_build_array(jsonb_build_object('name','Invalid','amount',-1))),saved_at);
  exception when check_violation then rejected:=true;
  end;
  if not rejected or (select stock_quantity from public.products where id=product_id)<>10 then raise exception 'FAIL: atomic rollback on invalid price'; end if;
  rejected := false;
  begin
    perform public.save_catalogue_product(product_id,jsonb_build_object('internal_code',code),'2000-01-01'::timestamptz);
  exception when raise_exception then rejected:=true;
  end;
  if not rejected then raise exception 'FAIL: stale edit protection'; end if;
  perform public.rename_product_category(category,category||' RENAMED');
  category := category||' RENAMED';
  if (select products.category from public.products where id=product_id)<>category then raise exception 'FAIL: rename category updates products'; end if;
  rejected:=false;
  begin perform public.delete_product_category(category,true,999); exception when raise_exception then rejected:=true; end;
  if not rejected or not exists(select 1 from public.products where id=product_id) then raise exception 'FAIL: category deletion count guard'; end if;

  insert into public.orders(order_number,name) overriding system value values(-900001,'QA '||suffix) returning id into order_id;
  perform public.scan_order_item(order_id,product_id);
  select id into item_id from public.order_items where order_items.order_id=order_id;
  perform public.set_order_item_quantity(item_id,3);
  if (select stock_quantity from public.products where id=product_id)<>7 then raise exception 'FAIL: quantity change adjusts stock'; end if;
  perform public.set_order_item_quantity(item_id,0);
  if (select stock_quantity from public.products where id=product_id)<>10 or exists(select 1 from public.order_items where id=item_id) then raise exception 'FAIL: remove order item restores stock'; end if;
  perform public.scan_order_item(order_id,product_id);
  perform public.close_order(order_id);
  perform public.manage_order(order_id,'QA renamed','Edited notes','closed');
  if (select notes from public.orders where id=order_id)<>'Edited notes' then raise exception 'FAIL: edit closed list metadata'; end if;
  select id into item_id from public.order_items where order_items.order_id=order_id;
  rejected:=false;
  begin perform public.set_order_item_quantity(item_id,2); exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'FAIL: closed list quantity guard'; end if;
  select updated_at into saved_at from public.products where id=product_id;
  perform public.save_catalogue_product(product_id,jsonb_build_object('internal_code',code||'-NEW','name','Edited','category',category,'stockQuantity',12,'crossReferences','[]'::jsonb,'prices','[]'::jsonb),saved_at);
  if exists(select 1 from public.product_identifiers where product_identifiers.product_id=product_id and normalized_value=code)
    or exists(select 1 from public.product_prices where product_prices.product_id=product_id)
    or (select stock_quantity from public.products where id=product_id)<>12 then raise exception 'FAIL: replace codes/prices and rectify stock'; end if;
  delete from public.products where id=product_id;
  if (select order_items.product_id from public.order_items where id=item_id) is not null
    or (select internal_code_snapshot from public.order_items where id=item_id)<>code then raise exception 'FAIL: preserve closed order snapshots after product deletion'; end if;
  perform public.manage_order(order_id,'QA reopened','','open');
  perform public.set_order_item_quantity(item_id,0);
  perform public.delete_catalogue_order(order_id,true);

  second_product:=public.save_catalogue_product(null,jsonb_build_object('internal_code',code||'-SECOND','category',category,'stockQuantity',10));
  perform public.delete_product_category(category,false,1);
  if (select products.category from public.products where id=second_product)<>'' then raise exception 'FAIL: remove category keeps products'; end if;
  perform public.save_catalogue_product(second_product,jsonb_build_object('internal_code',code||'-SECOND','category',category,'stockQuantity',10));
  insert into public.orders(order_number,name) overriding system value values(-900002,'QA restore '||suffix) returning id into order_id;
  perform public.scan_order_item(order_id,second_product);
  perform public.scan_order_item(order_id,second_product);
  perform public.close_order(order_id);
  perform public.delete_catalogue_order(order_id,true);
  if (select stock_quantity from public.products where id=second_product)<>10 or exists(select 1 from public.orders where id=order_id) then raise exception 'FAIL: delete closed order restores stock'; end if;
  insert into public.orders(order_number,name) overriding system value values(-900003,'QA keep stock '||suffix) returning id into order_id;
  perform public.scan_order_item(order_id,second_product);
  perform public.delete_catalogue_order(order_id,false);
  if (select stock_quantity from public.products where id=second_product)<>9 then raise exception 'FAIL: delete order without restoring stock'; end if;
  insert into public.orders(order_number,name) overriding system value values(-900004,'QA category delete '||suffix) returning id into order_id;
  perform public.scan_order_item(order_id,second_product);
  perform public.close_order(order_id);
  perform public.delete_product_category(category,true,1);
  if exists(select 1 from public.products where id=second_product) or exists(select 1 from public.product_categories where name=category)
    or not exists(select 1 from public.order_items where order_items.order_id=order_id and order_items.product_id is null) then raise exception 'FAIL: category bulk deletion preserves order'; end if;
  if has_function_privilege('anon','public.save_catalogue_product(uuid,jsonb,timestamptz)','EXECUTE') then raise exception 'FAIL: anonymous write access'; end if;
end;
$$;
rollback;
select 'OK: products, automatic barcodes, prices, stock, categories, closed orders, deletions, rollback and access control' as result;
