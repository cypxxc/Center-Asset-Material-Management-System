-- Drizzle runs the complete migration in a transaction. Block concurrent metadata/item writes.
LOCK TABLE public.categories, public.items, public.materials IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
ALTER TABLE public.categories ADD COLUMN item_type text NOT NULL DEFAULT 'asset';
ALTER TABLE public.categories ADD CONSTRAINT categories_item_type_check CHECK (item_type IN ('asset','material'));
ALTER TABLE public.categories DROP CONSTRAINT categories_name_unique;
CREATE UNIQUE INDEX categories_name_type_unique ON public.categories (name, item_type);
CREATE UNIQUE INDEX categories_id_type_unique ON public.categories (id, item_type);
--> statement-breakpoint
-- Include soft-deleted rows: their historical references must remain valid too.
ALTER TABLE public.categories DISABLE TRIGGER categories_stamp;
UPDATE public.categories c SET item_type = 'material'
WHERE EXISTS (SELECT 1 FROM public.materials m WHERE m.category_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.category_id = c.id);
ALTER TABLE public.categories ENABLE TRIGGER categories_stamp;
--> statement-breakpoint
-- Shared categories keep their original ID for assets; clone metadata for materials.
INSERT INTO public.categories (name, item_type, description, color, icon, is_active, created_at, updated_at)
SELECT c.name, 'material', c.description, c.color, c.icon, c.is_active, c.created_at, c.updated_at
FROM public.categories c
WHERE c.item_type = 'asset'
  AND EXISTS (SELECT 1 FROM public.materials m WHERE m.category_id = c.id);
--> statement-breakpoint
-- This is a reference migration, not an inventory edit. Keep original timestamps/versions.
-- Audit triggers remain enabled, so the reference remap is still traceable.
ALTER TABLE public.materials DISABLE TRIGGER materials_stamp;
ALTER TABLE public.materials DISABLE TRIGGER version_material_changes;
UPDATE public.materials m SET category_id = material_category.id
FROM public.categories asset_category
JOIN public.categories material_category ON material_category.name = asset_category.name AND material_category.item_type = 'material'
WHERE m.category_id = asset_category.id AND asset_category.item_type = 'asset';
ALTER TABLE public.materials ENABLE TRIGGER version_material_changes;
ALTER TABLE public.materials ENABLE TRIGGER materials_stamp;
--> statement-breakpoint
ALTER TABLE public.items ADD CONSTRAINT items_category_type_fk
  FOREIGN KEY (category_id, item_type) REFERENCES public.categories (id, item_type);
ALTER TABLE public.materials ADD CONSTRAINT materials_category_type_fk
  FOREIGN KEY (category_id, item_type) REFERENCES public.categories (id, item_type);
