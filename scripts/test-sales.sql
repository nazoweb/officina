-- Isolated synthetic operator and records; the entire test is rolled back.
begin;
insert into auth.users(id,email,aud,role) values(gen_random_uuid(),'qa-sales-'||gen_random_uuid()||'@example.invalid','authenticated','authenticated');
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email like 'qa-sales-%@example.invalid' order by created_at desc limit 1),true);
with other as (
 insert into auth.users(id,email,aud,role) values(gen_random_uuid(),'qa-sales-other-'||gen_random_uuid()||'@example.invalid','authenticated','authenticated') returning id
) select set_config('qa.sales.other',id::text,true) from other;
set local role authenticated;
do $$
declare
 s jsonb; again jsonb; printed jsonb; pid uuid; service_id uuid; customer uuid;
 original_actor uuid:=auth.uid(); operation uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); sale_id uuid; original jsonb; rejected boolean;
 goods_code text:='QA-SALE-'||gen_random_uuid(); cancelled jsonb;
begin
 pid:=public.save_catalogue_product(null,jsonb_build_object('internal_code',goods_code,'name','QA starter','supplier','QA supplier','supplierCode','SUP-123','stockQuantity',10,'purchasePrice','73.25','prices',jsonb_build_array(jsonb_build_object('name','Prezzo vendita','amount',180))));
 service_id:=public.save_catalogue_product(null,jsonb_build_object('internal_code','QA-SERVICE-'||gen_random_uuid(),'name','QA labour','kind','service','unit','ore','stockQuantity',0,'prices',jsonb_build_array(jsonb_build_object('name','Prezzo vendita','amount',42.70))));
 insert into public.business_clients(name,address,city,vat_number) values('QA sale client','Via QA 1','Roma','QA'||gen_random_uuid()) returning id into customer;
 s:=public.sales_command('open');sale_id:=(s->>'id')::uuid;
 again:=public.sales_command('open');if s->>'id'<>again->>'id' then raise exception 'FAIL: one active cart'; end if;
 s:=public.sales_command('add',sale_id,null,jsonb_build_object('product_id',pid,'operation_id',operation));
 again:=public.sales_command('add',sale_id,null,jsonb_build_object('product_id',pid,'operation_id',operation));
 if again->'lines'->0->>'quantity'<>'1' then raise exception 'FAIL: idempotent scan'; end if;
 s:=public.sales_command('add',sale_id,null,jsonb_build_object('product_id',pid,'operation_id',gen_random_uuid()));
 if s->'lines'->0->>'quantity'<>'2' then raise exception 'FAIL: repeated scans increment'; end if;
 if (select stock_quantity from public.products where id=pid)<>10 then raise exception 'FAIL: draft changed stock'; end if;
 s:=public.sales_command('line',sale_id,(s->>'version')::integer,jsonb_build_object('index',0,'quantity','3.000','unit_price','180','discount','10'));
 if (s->>'total')::numeric<>486 then raise exception 'FAIL: exact sale total'; end if;
 rejected:=false;
 begin perform public.sales_command('line',sale_id,1,jsonb_build_object('index',0,'quantity','9','unit_price','180','discount','0'));exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: stale version'; end if;
 rejected:=false;
 begin perform public.sales_command('line',sale_id,(s->>'version')::integer,jsonb_build_object('index',0,'quantity','1.5','unit_price','180','discount','0'));exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: fractional goods'; end if;
 s:=public.sales_command('add',sale_id,null,jsonb_build_object('product_id',service_id,'operation_id',gen_random_uuid()));
 s:=public.sales_command('line',sale_id,(s->>'version')::integer,jsonb_build_object('index',1,'quantity','2.5','unit_price','42.70','discount','0'));
 s:=public.sales_command('edit',sale_id,(s->>'version')::integer,jsonb_build_object('client_id',customer,'customer_name','Ignored','payment_method','Carta','notes','QA notes'));
 -- DDT validation failure must leave the cart, stock and reorder list unchanged.
 update public.delivery_settings set fiscal_verified=false where id;
 rejected:=false;
 begin perform public.sales_command('close',sale_id,(s->>'version')::integer,'{"issue_ddt":true}');exception when raise_exception then rejected:=true;end;
 if not rejected or (select stock_quantity from public.products where id=pid)<>10 or (select status from public.sales where id=sale_id)<>'draft' then raise exception 'FAIL: atomic failed DDT'; end if;
 update public.delivery_settings set name='QA workshop',address='Via QA',city='Roma',vat_number='QA123',fiscal_verified=true where id;
 s:=public.sales_command('close',sale_id,(s->>'version')::integer,'{"issue_ddt":true}');
 if s->>'status'<>'closed' or (s->>'total')::numeric<>592.75 or (select stock_quantity from public.products where id=pid)<>7 then raise exception 'FAIL: close stock and totals'; end if;
 if (select stock_quantity from public.products where id=service_id)<>0 then raise exception 'FAIL: service changed stock'; end if;
 if not exists(select 1 from public.delivery_documents where id=(s->>'delivery_document_id')::uuid and status='issued') then raise exception 'FAIL: linked issued DDT'; end if;
 if (select count(*) from public.reorder_entries re where re.sale_id=(s->>'id')::uuid)<>1 then raise exception 'FAIL: goods reorder only'; end if;
 if (select quantity from public.reorder_entries re where re.sale_id=(s->>'id')::uuid)<>3 then raise exception 'FAIL: sold quantity'; end if;
 again:=public.sales_command('close',sale_id,1,'{"issue_ddt":true}');
 if again->>'number'<>s->>'number' or (select stock_quantity from public.products where id=pid)<>7 then raise exception 'FAIL: idempotent close'; end if;
 original:=s;
 update public.products set name='Changed after sale',purchase_price=99 where id=pid;
 if (select lines->0->>'description' from public.sales where id=sale_id)<>'QA starter' then raise exception 'FAIL: receipt snapshot'; end if;
 if position('purchase' in (s->'lines')::text)>0 then raise exception 'FAIL: internal cost leaked'; end if;
 printed:=public.sales_command('snapshot',request);
 again:=public.sales_command('snapshot',request);
 if printed->>'id'<>again->>'id' then raise exception 'FAIL: idempotent snapshot'; end if;
 if not exists(select 1 from public.reorder_entries re where re.sale_id=(s->>'id')::uuid and removed_at is null) then raise exception 'FAIL: printing removed pending items'; end if;
 cancelled:=public.sales_command('void',sale_id,(s->>'version')::integer,'{"reason":"QA cancellation","restore_stock":true}');
 if cancelled->>'status'<>'void' or (select stock_quantity from public.products where id=pid)<>10 then raise exception 'FAIL: void stock'; end if;
 if not exists(select 1 from public.reorder_entries re where re.sale_id=(s->>'id')::uuid and removed_at is null) then raise exception 'FAIL: automatic removal on void'; end if;
 if (select status from public.delivery_documents where id=(s->>'delivery_document_id')::uuid)<>'void' then raise exception 'FAIL: linked DDT cancellation'; end if;
 perform public.sales_command('void',sale_id,(cancelled->>'version')::integer,'{"reason":"retry","restore_stock":true}');
 if (select stock_quantity from public.products where id=pid)<>10 then raise exception 'FAIL: double restore'; end if;
 perform public.sales_command('remove_reorder',null,null,jsonb_build_object('ids',(select jsonb_agg(id) from public.reorder_entries re where re.sale_id=(s->>'id')::uuid)));
 if exists(select 1 from public.reorder_entries re where re.sale_id=(s->>'id')::uuid and removed_at is null) then raise exception 'FAIL: manual removal'; end if;
 if (select lines from public.reorder_prints where id=request) is distinct from printed->'lines' then raise exception 'FAIL: immutable print'; end if;
 s:=public.sales_command('open');
 if s->>'id'=sale_id::text or jsonb_array_length(s->'lines')<>0 then raise exception 'FAIL: new empty cart'; end if;
 -- Drafts belong to the current operator, both through RLS and the RPC mutation boundary.
 perform set_config('request.jwt.claim.sub',current_setting('qa.sales.other'),true);
 if exists(select 1 from public.sales where id=(s->>'id')::uuid) then raise exception 'FAIL: another operator can read draft'; end if;
 rejected:=false;
 begin perform public.sales_command('add',(s->>'id')::uuid,null,jsonb_build_object('product_id',pid,'operation_id',gen_random_uuid()));exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'FAIL: another operator can mutate draft'; end if;
 perform set_config('request.jwt.claim.sub',original_actor::text,true);
 perform public.sales_command('discard',(s->>'id')::uuid,(s->>'version')::integer);
 -- A normal counter sale retains the free-text customer without needing an account/company.
 s:=public.sales_command('open');
 s:=public.sales_command('add',(s->>'id')::uuid,null,jsonb_build_object('product_id',pid,'operation_id',gen_random_uuid()));
 s:=public.sales_command('edit',(s->>'id')::uuid,(s->>'version')::integer,'{"customer_name":"Antonio","notes":"","payment_method":"Contanti"}');
 s:=public.sales_command('close',(s->>'id')::uuid,(s->>'version')::integer);
 if s->'client_snapshot'->>'name'<>'Antonio' then raise exception 'FAIL: counter customer snapshot'; end if;
 -- A DDT issued later is linked once and never deducts stock again.
 s:=public.sales_command('open');
 s:=public.sales_command('add',(s->>'id')::uuid,null,jsonb_build_object('product_id',pid,'operation_id',gen_random_uuid()));
 s:=public.sales_command('edit',(s->>'id')::uuid,(s->>'version')::integer,jsonb_build_object('client_id',customer));
 s:=public.sales_command('close',(s->>'id')::uuid,(s->>'version')::integer);
 update public.products set active=false,kind='service',name='Changed again' where id=pid;
 s:=public.sales_command('document',(s->>'id')::uuid,(s->>'version')::integer);
 again:=public.sales_command('document',(s->>'id')::uuid,(s->>'version')::integer);
 if s->>'delivery_document_id'<>again->>'delivery_document_id' or (select stock_quantity from public.products where id=pid)<>8 then raise exception 'FAIL: late DDT changed stock or duplicated'; end if;
 if (select kind from public.delivery_documents where id=(s->>'delivery_document_id')::uuid)<>'ddt' then raise exception 'FAIL: late DDT used changed catalogue kind'; end if;
 if has_table_privilege('authenticated','public.sales','UPDATE') or has_table_privilege('authenticated','public.reorder_prints','DELETE') then raise exception 'FAIL: writable history'; end if;
 if has_function_privilege('anon','public.sales_command(text,uuid,integer,jsonb)','EXECUTE') then raise exception 'FAIL: anonymous mutation'; end if;
end $$;
rollback;
