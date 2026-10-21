-- Explicit deny policies document the private tables' client access boundary.
-- The private command runs as owner; it remains the only mutation path.
create policy counters_no_client_access on sales_private.counters for all to authenticated using(false) with check(false);
create policy scan_operations_no_client_access on sales_private.scan_operations for all to authenticated using(false) with check(false);
