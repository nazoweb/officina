create table public.activity_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  actor_id uuid not null default auth.uid(),
  session_id uuid,
  action text not null check (length(action)<=80),
  status text not null check (status in ('success','error')),
  route text not null check (length(route)<=300),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text)<=12000),
  user_message text,
  technical_code text,
  technical_message text
);
create index activity_events_created_idx on public.activity_events(created_at desc);
create index activity_events_actor_idx on public.activity_events(actor_id, created_at desc);
alter table public.activity_events enable row level security;
create policy activity_insert on public.activity_events for insert to authenticated with check (actor_id=(select auth.uid()));
create policy activity_read on public.activity_events for select to authenticated using ((select auth.uid()) is not null);
revoke all on public.activity_events from anon, authenticated;
grant insert on public.activity_events to authenticated;
-- Staff can consult the history; technical details are accessible only to database administrators.
grant select (id,created_at,actor_id,session_id,action,status,route,metadata,user_message,technical_code) on public.activity_events to authenticated;
create function public.record_activity_event(p_id uuid,p_session_id uuid,p_action text,p_status text,p_route text,p_metadata jsonb default '{}',p_user_message text default null,p_technical_code text default null,p_technical_message text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto.'; end if;
  insert into public.activity_events(id,actor_id,session_id,action,status,route,metadata,user_message,technical_code,technical_message)
  values(p_id,auth.uid(),p_session_id,p_action,p_status,p_route,p_metadata,left(p_user_message,2000),left(p_technical_code,80),left(p_technical_message,2000)) on conflict(id) do nothing;
end; $$;
revoke all on function public.record_activity_event(uuid,uuid,text,text,text,jsonb,text,text,text) from public, anon;
grant execute on function public.record_activity_event(uuid,uuid,text,text,text,jsonb,text,text,text) to authenticated;
notify pgrst,'reload schema';
