-- Allow anonymous users to SELECT from applicants for registration status checking
-- This enables public registration verification without requiring authentication

create policy applicants_select_public
on public.applicants
for select
to anon, authenticated
using (true);
