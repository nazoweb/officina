-- Cover the new foreign keys without changing existing workshop tables' access rules.
create index sales_created_by_idx on public.sales(created_by);
create index sales_closed_by_idx on public.sales(closed_by);
create index sales_cancelled_by_idx on public.sales(cancelled_by);
create index reorder_entries_removed_by_idx on public.reorder_entries(removed_by);
create index reorder_prints_created_by_idx on public.reorder_prints(created_by);
create index scan_operations_sale_idx on sales_private.scan_operations(sale_id);
