-- Marketing site waitlist. Visitors can add an email; nobody can read the list
-- with the public key. Read it from the Supabase dashboard or with the service key.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' and length(email) <= 254),
  source text default 'website',
  created_at timestamp with time zone default now()
);
alter table public.waitlist enable row level security;
drop policy if exists "waitlist_insert" on public.waitlist;
create policy "waitlist_insert" on public.waitlist for insert to anon, authenticated with check (true);
