-- Migration: 00042_add_color_to_categories.sql
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#64748B';

COMMENT ON COLUMN public.categories.color IS 'HEX 6-digit color code for category badge (e.g. #3B82F6)';
