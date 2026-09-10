-- Minimal schema with the current CAMMS policy predicates; local PGlite only.
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE profiles (id uuid PRIMARY KEY, role text, is_active boolean, full_name text);
CREATE FUNCTION private.current_app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_active = true $$;
REVOKE ALL ON FUNCTION private.current_app_role() FROM PUBLIC;
GRANT USAGE ON SCHEMA private, auth TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_app_role() TO authenticated;
CREATE TABLE items (id integer PRIMARY KEY, item_name text, deleted_at timestamptz);
CREATE TABLE categories (id integer PRIMARY KEY, is_active boolean);
CREATE TABLE locations (LIKE categories INCLUDING ALL);
CREATE TABLE units (LIKE categories INCLUDING ALL);
CREATE TABLE asset_number_templates (id integer PRIMARY KEY);
CREATE TABLE audit_logs (id integer PRIMARY KEY, user_id uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_number_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()) OR private.current_app_role() = 'admin');
CREATE POLICY profiles_admin_manage ON profiles FOR ALL TO authenticated USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid()) AND private.current_app_role() IS NOT NULL) WITH CHECK (id = (SELECT auth.uid()) AND private.current_app_role() IS NOT NULL);
CREATE POLICY items_read ON items FOR SELECT TO authenticated USING (private.current_app_role() IS NOT NULL AND (deleted_at IS NULL OR private.current_app_role() IN ('admin', 'staff')));
CREATE POLICY items_create ON items FOR INSERT TO authenticated WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY items_update ON items FOR UPDATE TO authenticated USING (private.current_app_role() IN ('admin', 'staff')) WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY items_direct_delete ON items FOR DELETE TO authenticated USING (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY categories_read ON categories FOR SELECT TO authenticated USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY locations_read ON locations FOR SELECT TO authenticated USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY units_read ON units FOR SELECT TO authenticated USING ((is_active AND private.current_app_role() IS NOT NULL) OR private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY categories_admin_manage ON categories FOR ALL TO authenticated USING (private.current_app_role() IN ('admin', 'staff')) WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY locations_admin_manage ON locations FOR ALL TO authenticated USING (private.current_app_role() IN ('admin', 'staff')) WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY units_admin_manage ON units FOR ALL TO authenticated USING (private.current_app_role() IN ('admin', 'staff')) WITH CHECK (private.current_app_role() IN ('admin', 'staff'));
CREATE POLICY audit_logs_read ON audit_logs FOR SELECT TO authenticated USING (private.current_app_role() = 'admin');
CREATE POLICY audit_logs_create ON audit_logs FOR INSERT TO authenticated WITH CHECK (private.current_app_role() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY asset_number_templates_read ON asset_number_templates FOR SELECT TO authenticated USING (private.current_app_role() IS NOT NULL);
CREATE POLICY asset_number_templates_admin_manage ON asset_number_templates FOR ALL TO authenticated USING (private.current_app_role() = 'admin') WITH CHECK (private.current_app_role() = 'admin');
INSERT INTO profiles VALUES
('00000000-0000-0000-0000-000000000001', 'admin', true, 'Admin'),
('00000000-0000-0000-0000-000000000002', 'staff', true, 'Staff'),
('00000000-0000-0000-0000-000000000003', 'viewer', true, 'Viewer'),
('00000000-0000-0000-0000-000000000004', 'admin', false, 'Inactive');
INSERT INTO categories VALUES (1, true), (2, false);
INSERT INTO locations SELECT * FROM categories;
INSERT INTO units SELECT * FROM categories;
INSERT INTO asset_number_templates VALUES (1);
INSERT INTO audit_logs VALUES (1, '00000000-0000-0000-0000-000000000001');
