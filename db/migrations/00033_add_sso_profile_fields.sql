-- Migration: Add department and avatar_url to profiles for SSO integration
-- 00033_add_sso_profile_fields.sql

alter table public.profiles
  add column if not exists department text,
  add column if not exists avatar_url text;
