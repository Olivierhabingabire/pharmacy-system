-- Pharmacy Desk: tables, constraints and Row Level Security.
-- Run this in the Supabase SQL Editor, then run seed.sql.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('pharmacist', 'manager', 'customer')),
  email text not null default '',
  full_name text not null default '',
  is_active boolean not null default true,
  phone text not null default ''
);

create table registration_settings (
  id smallint primary key check (id = 1),
  code_hash text not null,
  updated_at timestamptz not null default now()
);

create table medicines (
  id bigint generated always as identity primary key,
  name text not null,
  price numeric(10,2) not null check (price > 0),
  stock integer not null check (stock >= 0),
  expiry_date date not null
);

create table sales (
  id bigint generated always as identity primary key,
  receipt_id uuid not null,
  medicine_id bigint not null references medicines(id),
  qty integer not null check (qty > 0),
  seller_id uuid not null references auth.users(id),
  unit_price numeric(10,2) not null,
  sold_at timestamptz not null default now()
);

create table customer_orders (
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

create table customer_order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references customer_orders(id) on delete cascade,
  medicine_id bigint not null references medicines(id),
  qty integer not null check (qty > 0),
  unit_price numeric(10,2) not null check (unit_price > 0),
  unique (order_id, medicine_id)
);

-- Row Level Security ON with no policies: the public Supabase key cannot read
-- or write these tables. Only Django, connecting with the database password,
-- can. This is deliberate.
alter table profiles enable row level security;
alter table registration_settings enable row level security;
alter table medicines enable row level security;
alter table sales enable row level security;
alter table customer_orders enable row level security;
alter table customer_order_items enable row level security;