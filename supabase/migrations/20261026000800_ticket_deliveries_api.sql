-- "Email my ticket" moves to the API (Change 1): gventz_api reads and appends the delivery log
-- that 20261025000100_ticket_deliveries created for the website's service-role client.
-- Append-only for the API, like audit_log; still nothing for anon or signed-in users.

set lock_timeout = '5s';

grant select, insert on table public.ticket_deliveries to gventz_api;

drop policy if exists "api_read" on public.ticket_deliveries;
create policy "api_read" on public.ticket_deliveries for select to gventz_api using (true);
drop policy if exists "api_insert" on public.ticket_deliveries;
create policy "api_insert" on public.ticket_deliveries for insert to gventz_api with check (true);
