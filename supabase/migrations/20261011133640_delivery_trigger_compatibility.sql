create or replace function public.touch_delivery_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger business_clients_touch on public.business_clients;
create trigger business_clients_touch before update on public.business_clients for each row execute function public.touch_delivery_updated_at();
drop trigger delivery_settings_touch on public.delivery_settings;
create trigger delivery_settings_touch before update on public.delivery_settings for each row execute function public.touch_delivery_updated_at();
create policy counters_no_direct_access on public.delivery_counters for select to authenticated using(false);
