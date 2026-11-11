ALTER TABLE public.items ADD COLUMN qualification_status text;
ALTER TABLE public.items
  ADD CONSTRAINT items_qualification_status_check
  CHECK (qualification_status IS NULL OR qualification_status IN ('qualified', 'below_threshold'));
CREATE INDEX items_qualification_status_index
  ON public.items (qualification_status)
  WHERE deleted_at IS NULL;
