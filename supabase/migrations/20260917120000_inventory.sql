create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  internal_code text not null,
  name text not null default '',
  description text not null default '',
  brand text not null default '',
  category text not null default '',
  location text not null default '',
  unit text not null default 'pz',
  stock_quantity integer not null default 0,
  minimum_stock integer,
  supplier text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (internal_code)
);

create table if not exists public.product_identifiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('barcode', 'internal_code', 'mav', 'cross_reference', 'supplier_code')),
  value text not null,
  normalized_value text not null,
  created_at timestamptz not null default now(),
  unique (product_id, normalized_value)
);
create index if not exists product_identifiers_normalized_value_idx on public.product_identifiers(normalized_value);

create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, price_list_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  name text not null,
  notes text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  product_name_snapshot text not null,
  internal_code_snapshot text not null,
  unit_snapshot text not null default 'pz',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  order_id uuid references public.orders(id),
  order_item_id uuid references public.order_items(id),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('initial_import', 'order_scan', 'order_quantity_change', 'manual_adjustment', 'local_migration')),
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create or replace trigger product_prices_updated_at before update on public.product_prices for each row execute function public.set_updated_at();
create or replace trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create or replace trigger order_items_updated_at before update on public.order_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.prevent_closed_order_changes() returns trigger language plpgsql as $$
declare target_order uuid;
declare order_status text;
begin
  target_order := coalesce(old.order_id, new.order_id);
  select status into order_status from public.orders where id = target_order;
  if order_status = 'closed' then raise exception 'Gli ordini chiusi sono in sola lettura'; end if;
  return coalesce(new, old);
end;
$$;
create trigger order_items_open_only before insert or update or delete on public.order_items for each row execute function public.prevent_closed_order_changes();

create or replace function public.prevent_reopen_order() returns trigger language plpgsql as $$
begin
  if old.status = 'closed' and new is distinct from old then raise exception 'Un ordine chiuso non può essere modificato'; end if;
  return new;
end;
$$;
create trigger orders_closed_read_only before update on public.orders for each row execute function public.prevent_reopen_order();

create or replace function public.scan_order_item(p_order_id uuid, p_product_id uuid)
returns table (order_item_id uuid, product_id uuid, quantity integer, stock_quantity integer)
language plpgsql security invoker set search_path = public as $$
declare current_order public.orders; current_product public.products; item_id uuid; item_quantity integer;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Lista ordine non trovata'; end if;
  if current_order.status <> 'open' then raise exception 'La lista ordine è chiusa'; end if;
  select * into current_product from public.products where id = p_product_id and active = true for update;
  if not found then raise exception 'Prodotto non disponibile'; end if;
  insert into public.order_items (order_id, product_id, quantity, product_name_snapshot, internal_code_snapshot, unit_snapshot)
  values (p_order_id, p_product_id, 1, current_product.name, current_product.internal_code, current_product.unit)
  on conflict (order_id, product_id) do update set quantity = public.order_items.quantity + 1
  returning id, quantity into item_id, item_quantity;
  update public.products set stock_quantity = stock_quantity - 1 where id = p_product_id returning stock_quantity into stock_quantity;
  insert into public.inventory_movements (product_id, order_id, order_item_id, delta, reason, created_by)
  values (p_product_id, p_order_id, item_id, -1, 'order_scan', auth.uid());
  order_item_id := item_id; product_id := p_product_id; quantity := item_quantity; return next;
end;
$$;

create or replace function public.set_order_item_quantity(p_order_item_id uuid, p_quantity integer)
returns table (stock_quantity integer)
language plpgsql security invoker set search_path = public as $$
declare item public.order_items; order_status text; difference integer;
begin
  select * into item from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'Riga ordine non trovata'; end if;
  select status into order_status from public.orders where id = item.order_id;
  if order_status <> 'open' then raise exception 'La lista ordine è chiusa'; end if;
  if p_quantity < 0 then raise exception 'Quantità non valida'; end if;
  difference := p_quantity - item.quantity;
  if p_quantity = 0 then delete from public.order_items where id = item.id; else update public.order_items set quantity = p_quantity where id = item.id; end if;
  update public.products set stock_quantity = stock_quantity - difference where id = item.product_id returning public.products.stock_quantity into stock_quantity;
  if difference <> 0 then insert into public.inventory_movements (product_id, order_id, order_item_id, delta, reason, created_by)
    values (item.product_id, item.order_id, item.id, -difference, 'order_quantity_change', auth.uid()); end if;
  return next;
end;
$$;

create or replace function public.close_order(p_order_id uuid) returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.orders set status = 'closed', closed_at = now(), closed_by = auth.uid() where id = p_order_id and status = 'open';
  if not found then raise exception 'Lista non trovata o già chiusa'; end if;
end;
$$;

create or replace function public.adjust_product_stock(p_product_id uuid, p_delta integer, p_note text default '')
returns integer language plpgsql security invoker set search_path = public as $$
declare new_stock integer;
begin
  if p_delta = 0 then raise exception 'La rettifica non può essere zero'; end if;
  update public.products set stock_quantity = stock_quantity + p_delta where id = p_product_id returning stock_quantity into new_stock;
  if not found then raise exception 'Prodotto non trovato'; end if;
  insert into public.inventory_movements (product_id, delta, reason, note, created_by) values (p_product_id, p_delta, 'manual_adjustment', p_note, auth.uid());
  return new_stock;
end;
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_identifiers enable row level security;
alter table public.price_lists enable row level security;
alter table public.product_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "authenticated access" on public.profiles for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.products for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.product_identifiers for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.price_lists for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.product_prices for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.orders for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.order_items for all to authenticated using (true) with check (true);
create policy "authenticated access" on public.inventory_movements for all to authenticated using (true) with check (true);

grant execute on function public.scan_order_item(uuid, uuid) to authenticated;
grant execute on function public.set_order_item_quantity(uuid, integer) to authenticated;
grant execute on function public.close_order(uuid) to authenticated;
grant execute on function public.adjust_product_stock(uuid, integer, text) to authenticated;
