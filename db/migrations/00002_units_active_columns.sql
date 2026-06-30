-- Add soft-disable support to units for Phase 3 Settings Management.

alter table public.units
  add column if not exists is_active boolean not null default true;

alter table public.units
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_units_is_active on public.units(is_active);
