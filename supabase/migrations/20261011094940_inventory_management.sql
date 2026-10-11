-- Shared workshop: authenticated staff can manage the same catalogue.
create table public.product_categories (name text primary key check (length(btrim(name)) > 0));
alter table public.product_categories enable row level security;
revoke all on public.product_categories from anon;
grant select, insert, update, delete on public.product_categories to authenticated;
create policy "staff catalogue access" on public.product_categories for all to authenticated
  using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
insert into public.product_categories(name) select distinct category from public.products where btrim(category) <> '';

create function public.register_product_category() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.category := btrim(new.category);
  if new.category <> '' then insert into public.product_categories(name) values(new.category) on conflict do nothing; end if;
  return new;
end;
$$;
create trigger register_product_category before insert or update of category on public.products
for each row execute function public.register_product_category();

-- Preserve order snapshots and movement history when a catalogue item is deleted.
alter table public.order_items alter column product_id drop not null;
alter table public.order_items drop constraint order_items_product_id_fkey;
alter table public.order_items add constraint order_items_product_id_fkey foreign key(product_id) references public.products(id) on delete set null;
alter table public.inventory_movements alter column product_id drop not null;
alter table public.inventory_movements drop constraint inventory_movements_product_id_fkey;
alter table public.inventory_movements add constraint inventory_movements_product_id_fkey foreign key(product_id) references public.products(id) on delete set null;
alter table public.inventory_movements drop constraint inventory_movements_order_item_id_fkey;
alter table public.inventory_movements add constraint inventory_movements_order_item_id_fkey foreign key(order_item_id) references public.order_items(id) on delete set null;
alter table public.inventory_movements drop constraint inventory_movements_order_id_fkey;
alter table public.inventory_movements add constraint inventory_movements_order_id_fkey foreign key(order_id) references public.orders(id) on delete set null;

-- Closed lists can be renamed or reopened; quantity edits still require an open list.
drop trigger if exists orders_closed_read_only on public.orders;
create or replace function public.prevent_closed_order_changes() returns trigger language plpgsql set search_path=public as $$
declare target_order uuid; order_status text;
begin
  if tg_op = 'UPDATE' and old.product_id is not null and new.product_id is null
    and (to_jsonb(new) - 'product_id' - 'updated_at') = (to_jsonb(old) - 'product_id' - 'updated_at') then
    return new;
  end if;
  if tg_op = 'INSERT' then target_order := new.order_id; else target_order := old.order_id; end if;
  select status into order_status from public.orders where id=target_order;
  if order_status='closed' then raise exception 'Riapri la lista prima di modificarne i prodotti.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger order_items_open_only on public.order_items;
create trigger order_items_open_only before insert or update or delete on public.order_items
for each row execute function public.prevent_closed_order_changes();

create function public.save_catalogue_product(p_product_id uuid, p_draft jsonb, p_expected_updated_at timestamptz default null)
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
    insert into public.products(internal_code,name,description,brand,category,location,unit,stock_quantity,minimum_stock,supplier,notes,created_by)
    values(code,product_name,coalesce(p_draft->>'description',''),coalesce(p_draft->>'brand',''),coalesce(p_draft->>'category',''),
      coalesce(p_draft->>'location',''),coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),new_stock,(p_draft->>'minimumStock')::integer,
      coalesce(p_draft->>'supplier',''),coalesce(p_draft->>'notes',''),auth.uid()) returning id into target_id;
    delta := new_stock;
  else
    target_id := p_product_id;
    delta := new_stock-existing.stock_quantity;
    update public.products set internal_code=code,name=product_name,description=coalesce(p_draft->>'description',''),
      brand=coalesce(p_draft->>'brand',''),category=coalesce(p_draft->>'category',''),location=coalesce(p_draft->>'location',''),
      unit=coalesce(nullif(btrim(p_draft->>'unit'),''),'pz'),stock_quantity=new_stock,minimum_stock=(p_draft->>'minimumStock')::integer,
      supplier=coalesce(p_draft->>'supplier',''),notes=coalesce(p_draft->>'notes','') where id=target_id;
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

create function public.rename_product_category(p_name text, p_new_name text) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Accedi per gestire le categorie.'; end if;
  if btrim(p_new_name)='' then raise exception 'Inserisci un nome per la categoria.'; end if;
  perform 1 from public.product_categories where name=p_name for update;
  if not found then raise exception 'Categoria non trovata.'; end if;
  if p_name=btrim(p_new_name) then return; end if;
  insert into public.product_categories(name) values(btrim(p_new_name));
  update public.products set category=btrim(p_new_name) where category=p_name;
  delete from public.product_categories where name=p_name;
end;
$$;

create function public.delete_product_category(p_name text, p_delete_products boolean default false, p_expected_count integer default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare affected integer;
begin
  if auth.uid() is null then raise exception 'Accedi per gestire le categorie.'; end if;
  perform 1 from public.product_categories where name=p_name for update;
  if not found then raise exception 'Categoria non trovata.'; end if;
  perform 1 from public.products where category=p_name order by id for update;
  select count(*) into affected from public.products where category=p_name;
  if p_expected_count is not null and affected<>p_expected_count then raise exception 'La categoria è cambiata. Ricarica prima di eliminarla.'; end if;
  if p_delete_products then delete from public.products where category=p_name;
  else update public.products set category='' where category=p_name; end if;
  delete from public.product_categories where name=p_name;
  return affected;
end;
$$;

create function public.manage_order(p_order_id uuid, p_name text, p_notes text, p_status text) returns void
language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Accedi per gestire le liste.'; end if;
  if btrim(p_name)='' or p_status not in ('open','closed') or p_status is null then raise exception 'Nome o stato della lista non valido.'; end if;
  update public.orders set name=btrim(p_name),notes=coalesce(p_notes,''),status=p_status,
    closed_at=case when p_status='closed' then coalesce(closed_at,now()) else null end,
    closed_by=case when p_status='closed' then auth.uid() else null end where id=p_order_id;
  if not found then raise exception 'Lista non trovata.'; end if;
end;
$$;

create function public.delete_catalogue_order(p_order_id uuid, p_restore_stock boolean default true) returns void
language plpgsql security invoker set search_path=public as $$
declare item record;
begin
  if auth.uid() is null then raise exception 'Accedi per gestire le liste.'; end if;
  perform 1 from public.orders where id=p_order_id for update;
  if not found then raise exception 'Lista non trovata.'; end if;
  perform 1 from public.products where id in (select product_id from public.order_items where order_id=p_order_id) order by id for update;
  if p_restore_stock then
    for item in select product_id,sum(quantity)::integer as quantity from public.order_items where order_id=p_order_id and product_id is not null group by product_id loop
      update public.products set stock_quantity=stock_quantity+item.quantity where id=item.product_id;
      insert into public.inventory_movements(product_id,delta,reason,note,created_by)
        values(item.product_id,item.quantity,'manual_adjustment','Restituzione da lista eliminata',auth.uid());
    end loop;
  end if;
  update public.orders set status='open',closed_at=null,closed_by=null where id=p_order_id;
  delete from public.orders where id=p_order_id;
end;
$$;

-- Lock in the same order as a scan, and allow removing rows whose product was deleted.
create or replace function public.set_order_item_quantity(p_order_item_id uuid,p_quantity integer)
returns table(stock_quantity integer) language plpgsql security invoker set search_path=public as $$
declare item public.order_items; target_order uuid; order_status text; difference integer;
begin
  if auth.uid() is null then raise exception 'Accedi per modificare la lista.'; end if;
  select order_id into target_order from public.order_items where id=p_order_item_id;
  select status into order_status from public.orders where id=target_order for update;
  if not found then raise exception 'Lista non trovata.'; end if;
  if order_status<>'open' then raise exception 'Riapri la lista prima di modificarne i prodotti.'; end if;
  select * into item from public.order_items where id=p_order_item_id;
  if not found then raise exception 'Riga ordine non trovata.'; end if;
  perform 1 from public.products where id=item.product_id for update;
  if p_quantity is null or p_quantity<0 then raise exception 'Quantità non valida.'; end if;
  difference:=p_quantity-item.quantity;
  if p_quantity=0 then delete from public.order_items where id=item.id;
  else update public.order_items set quantity=p_quantity where id=item.id; end if;
  update public.products set stock_quantity=public.products.stock_quantity-difference where id=item.product_id returning public.products.stock_quantity into stock_quantity;
  if difference<>0 and item.product_id is not null then
    insert into public.inventory_movements(product_id,order_id,order_item_id,delta,reason,created_by)
    values(item.product_id,item.order_id,case when p_quantity=0 then null else item.id end,-difference,'order_quantity_change',auth.uid());
  end if;
  return next;
end;
$$;

revoke all on function public.register_product_category() from public,anon;
revoke all on function public.save_catalogue_product(uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.rename_product_category(text,text) from public,anon;
revoke all on function public.delete_product_category(text,boolean,integer) from public,anon;
revoke all on function public.manage_order(uuid,text,text,text) from public,anon;
revoke all on function public.delete_catalogue_order(uuid,boolean) from public,anon;
revoke all on function public.set_order_item_quantity(uuid,integer) from public,anon;
grant execute on function public.register_product_category() to authenticated;
grant execute on function public.save_catalogue_product(uuid,jsonb,timestamptz) to authenticated;
grant execute on function public.rename_product_category(text,text) to authenticated;
grant execute on function public.delete_product_category(text,boolean,integer) to authenticated;
grant execute on function public.manage_order(uuid,text,text,text) to authenticated;
grant execute on function public.delete_catalogue_order(uuid,boolean) to authenticated;
grant execute on function public.set_order_item_quantity(uuid,integer) to authenticated;
notify pgrst,'reload schema';
