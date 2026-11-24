-- Apply this once to an existing Pharmacy Desk database to enable pharmacist
-- registration. It is also safe to run after schema.sql on a new database.

alter table profiles
  add column if not exists email text not null default '',
  add column if not exists full_name text not null default '';

create table if not exists registration_settings (
  id smallint primary key check (id = 1),
  code_hash text not null,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table registration_settings enable row level security;
