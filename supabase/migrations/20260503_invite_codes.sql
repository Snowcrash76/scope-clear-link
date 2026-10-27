begin;

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

drop policy if exists "Service role can do everything on invite_codes" on public.invite_codes;
create policy "Service role can do everything on invite_codes"
  on public.invite_codes for all
  to service_role
  using (true)
  with check (true);

grant all on public.invite_codes to service_role;
notify pgrst, 'reload schema';
commit;
