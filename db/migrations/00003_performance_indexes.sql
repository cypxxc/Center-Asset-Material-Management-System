-- db/migrations/00003_performance_indexes.sql
-- Composite Index for Dashboard and List Filtering
CREATE INDEX IF NOT EXISTS idx_items_active_type_status 
ON items (deleted_at, item_type, status) 
WHERE deleted_at IS NULL;

-- Foreign Key Indexes for Fast Relational Joins
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_location_id ON items (location_id);

-- Case-Insensitive Item Name Search Index
CREATE INDEX IF NOT EXISTS idx_items_name_lower ON items (lower(item_name));
