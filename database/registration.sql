-- Apply this once to an existing Pharmacy Desk database to enable pharmacist
-- registration. It is also safe to run after schema.sql on a new database.

alter table profiles
  add column if not exists email text not null default '',
  add column if not exists full_name text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists phone text not null default '';

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('pharmacist', 'manager', 'customer'));

create table if not exists registration_settings (
  id smallint primary key check (id = 1),
  code_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists customer_orders (
  id uuid primary key,
  customer_id uuid not null references auth.users(id),
  status text not null check (
    status in ('submitted', 'ready_for_pickup', 'declined', 'completed', 'cancelled')
  ),
  customer_note text not null default '',
  staff_note text not null default '',
  pharmacist_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references customer_orders(id) on delete cascade,
  medicine_id bigint not null references medicines(id),
  qty integer not null check (qty > 0),
  unit_price numeric(10,2) not null check (unit_price > 0),
  unique (order_id, medicine_id)
);

alter table profiles enable row level security;
alter table registration_settings enable row level security;
alter table customer_orders enable row level security;
alter table customer_order_items enable row level security;
