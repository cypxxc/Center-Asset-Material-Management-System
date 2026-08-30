-- Development seed data for the Office Item Registry System.
-- The Auth token columns must be empty strings, not NULL, for GoTrue password login.

insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  raw_user_meta_data,
  raw_app_meta_data,
  is_super_admin,
  role,
  aud,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@registry.s',
    extensions.crypt('admin1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '', '', '', '',
    '{"full_name":"Admin Registry"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false, 'authenticated', 'authenticated', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'staff@registry.s',
    extensions.crypt('staff1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '', '', '', '',
    '{"full_name":"Staff Registry"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false, 'authenticated', 'authenticated', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'viewer@registry.s',
    extensions.crypt('viewer1234', extensions.gen_salt('bf')),
    now(), '', '', '', '', '', '', '', '',
    '{"full_name":"Viewer Registry"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    false, 'authenticated', 'authenticated', now(), now()
  )
on conflict (id) do update
set
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change_token_current = excluded.email_change_token_current,
  email_change = excluded.email_change,
  phone_change = excluded.phone_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  raw_user_meta_data = excluded.raw_user_meta_data,
  raw_app_meta_data = excluded.raw_app_meta_data,
  updated_at = now();

insert into public.profiles (id, full_name, email, role, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'Admin Registry', 'admin@registry.s', 'admin', true),
  ('00000000-0000-0000-0000-000000000002', 'Staff Registry', 'staff@registry.s', 'staff', true),
  ('00000000-0000-0000-0000-000000000003', 'Viewer Registry', 'viewer@registry.s', 'viewer', true)
on conflict (id) do update
set full_name = excluded.full_name, email = excluded.email, role = excluded.role, is_active = excluded.is_active;

insert into public.categories (name, description)
values
  ('Computer equipment', 'Computers, displays, and related equipment'),
  ('Office supplies', 'Consumable office supplies'),
  ('Furniture', 'Office furniture')
on conflict (name) do nothing;

insert into public.locations (name, building, floor, room, department)
select values_to_insert.name, values_to_insert.building, values_to_insert.floor, values_to_insert.room, values_to_insert.department
from (
  values
    ('IT Room', 'Building A', '3', '302', 'IT'),
    ('Main Office', 'Building A', '2', '201', 'Operations'),
    ('Storage', 'Building B', '1', '101', 'Administration')
) as values_to_insert(name, building, floor, room, department)
where not exists (
  select 1
  from public.locations existing
  where existing.name = values_to_insert.name
    and existing.building = values_to_insert.building
    and existing.room = values_to_insert.room
);

insert into public.units (name)
values ('Piece'), ('Set'), ('Box')
on conflict (name) do nothing;
