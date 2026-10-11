create or replace function public.scan_order_item(p_order_id uuid,p_product_id uuid)
returns table(order_item_id uuid,product_id uuid,quantity integer,stock_quantity integer)
language plpgsql security invoker set search_path=public as $$
declare current_order public.orders; current_product public.products; item_id uuid; item_quantity integer;
begin
  if auth.uid() is null then raise exception 'Accedi per aggiungere prodotti alla lista.'; end if;
  select * into current_order from public.orders where id=p_order_id for update;
  if not found or current_order.status<>'open' then raise exception 'Lista ordine non disponibile.'; end if;
  select * into current_product from public.products where id=p_product_id and active=true for update;
  if not found then raise exception 'Prodotto non disponibile.'; end if;
  insert into public.order_items(order_id,product_id,quantity,product_name_snapshot,internal_code_snapshot,unit_snapshot)
    values(p_order_id,p_product_id,1,current_product.name,current_product.internal_code,current_product.unit)
    on conflict on constraint order_items_order_id_product_id_key do update set quantity=public.order_items.quantity+1
    returning public.order_items.id,public.order_items.quantity into item_id,item_quantity;
  update public.products set stock_quantity=public.products.stock_quantity-1 where id=p_product_id
    returning public.products.stock_quantity into stock_quantity;
  insert into public.inventory_movements(product_id,order_id,order_item_id,delta,reason,created_by)
    values(p_product_id,p_order_id,item_id,-1,'order_scan',auth.uid());
  order_item_id:=item_id; product_id:=p_product_id; quantity:=item_quantity; return next;
end;
$$;
revoke all on function public.scan_order_item(uuid,uuid) from public,anon;
grant execute on function public.scan_order_item(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
