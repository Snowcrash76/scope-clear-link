create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "Service role can do everything on invite_codes"
  on invite_codes for all
  using (true)
  with check (true);
