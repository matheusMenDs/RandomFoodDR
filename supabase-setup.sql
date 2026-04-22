create extension if not exists pgcrypto;

create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.dishes disable row level security;
